# EduConnect

A real-time collaboration hub for college study groups.

**Stack:** Node.js · Express · MongoDB (Mongoose) · Socket.io · Multer · JWT · vanilla HTML/CSS/JS

## Features

- JWT authentication (register / sign in, 7-day tokens, bcrypt-hashed passwords)
- Create, search, join and leave study groups by subject and department
- Real-time group chat over WebSockets with live typing indicators and online presence
- File sharing (Multer, 10 MB limit, image previews) broadcast instantly to the room
- Pinned announcements: group owners can post announcements or pin any message
- Responsive single-page UI

## Run it

```bash
npm install
cp .env.example .env      # then set JWT_SECRET to a long random string
# make sure MongoDB is running locally (or point MONGO_URI at Atlas)
npm start
```

Open http://localhost:3000. Open a second browser window (or a private window) with another account to see messages, typing and pins sync live.

## Project layout

```
server.js            Express + Socket.io + Mongo bootstrap
socket.js            Socket auth, rooms, messages, typing, presence
routes/auth.js       Register, login, /me
routes/groups.js     Groups, membership, history, uploads, pinning
models/              User, Group, Message
middleware/          JWT auth, Multer upload rules
public/              Frontend (index.html, css/style.css, js/app.js)
uploads/             Stored files
```

## Notes for production

- Set a strong `JWT_SECRET` and serve over HTTPS.
- Uploaded files are served by unguessable filenames; for stricter privacy, put them behind an authenticated route or object storage.
- Add rate limiting (e.g. `express-rate-limit`) to the auth routes.
