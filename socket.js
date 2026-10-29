const Group = require('./models/Group');
const Message = require('./models/Message');
const { userFromToken } = require('./middleware/auth');
const { serializeMessage } = require('./routes/groups');

module.exports = function attachSockets(io) {
  // Authenticate every socket with the same JWT used by the REST API
  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth && socket.handshake.auth.token);
    if (!user) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  });

  const online = new Map(); // groupId -> Set of userIds

  function emitPresence(groupId) {
    const set = online.get(groupId);
    io.to(`group:${groupId}`).emit('presence', { groupId, userIds: set ? [...set] : [] });
  }

  io.on('connection', (socket) => {
    const me = socket.user;
    const joined = new Set();

    socket.on('group:join', async (groupId, ack) => {
      try {
        const group = await Group.findById(groupId);
        if (!group || !group.members.some((m) => String(m) === String(me._id))) {
          return ack && ack({ error: 'Not a member of this group.' });
        }
        socket.join(`group:${groupId}`);
        joined.add(groupId);
        if (!online.has(groupId)) online.set(groupId, new Set());
        online.get(groupId).add(String(me._id));
        emitPresence(groupId);
        ack && ack({ ok: true });
      } catch {
        ack && ack({ error: 'Could not join room.' });
      }
    });

    socket.on('group:leave', (groupId) => {
      socket.leave(`group:${groupId}`);
      joined.delete(groupId);
      const set = online.get(groupId);
      if (set) {
        // only drop presence if no other socket of this user is still in the room
        const stillThere = [...(io.sockets.adapter.rooms.get(`group:${groupId}`) || [])].some(
          (sid) => io.sockets.sockets.get(sid)?.user?._id.equals(me._id)
        );
        if (!stillThere) set.delete(String(me._id));
        emitPresence(groupId);
      }
    });

    socket.on('message:send', async ({ groupId, text, isAnnouncement } = {}, ack) => {
      try {
        const body = String(text || '').trim().slice(0, 2000);
        if (!body) return ack && ack({ error: 'Message is empty.' });
        const group = await Group.findById(groupId);
        if (!group || !group.members.some((m) => String(m) === String(me._id))) {
          return ack && ack({ error: 'Not a member of this group.' });
        }
        const isOwner = String(group.owner) === String(me._id);
        const msg = await Message.create({
          group: group._id,
          sender: me._id,
          text: body,
          isAnnouncement: !!isAnnouncement && isOwner,
          pinned: !!isAnnouncement && isOwner, // announcements are pinned automatically
        });
        await msg.populate('sender', 'name');
        const payload = serializeMessage(msg);
        io.to(`group:${groupId}`).emit('message:new', payload);
        if (payload.pinned) io.to(`group:${groupId}`).emit('message:pinned', payload);
        ack && ack({ ok: true });
      } catch {
        ack && ack({ error: 'Could not send message.' });
      }
    });

    socket.on('typing', ({ groupId, typing } = {}) => {
      if (!joined.has(groupId)) return;
      socket.to(`group:${groupId}`).emit('typing', { groupId, userId: String(me._id), name: me.name, typing: !!typing });
    });

    socket.on('disconnect', () => {
      for (const groupId of joined) {
        socket.to(`group:${groupId}`).emit('typing', { groupId, userId: String(me._id), name: me.name, typing: false });
        const set = online.get(groupId);
        if (!set) continue;
        const stillThere = [...(io.sockets.adapter.rooms.get(`group:${groupId}`) || [])].some(
          (sid) => sid !== socket.id && io.sockets.sockets.get(sid)?.user?._id.equals(me._id)
        );
        if (!stillThere) set.delete(String(me._id));
        emitPresence(groupId);
      }
    });
  });
};
