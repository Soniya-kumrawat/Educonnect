require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const Group = require('./models/Group');
const Message = require('./models/Message');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/educonnect';
const DEMO_PASSWORD = 'demo123';

const people = [
  { name: 'Aarav Sharma', email: 'aarav@demo.edu', department: 'Computer Science', year: '3rd' },
  { name: 'Priya Verma', email: 'priya@demo.edu', department: 'Computer Science', year: '2nd' },
  { name: 'Rohan Mehta', email: 'rohan@demo.edu', department: 'Electronics', year: '3rd' },
  { name: 'Ananya Iyer', email: 'ananya@demo.edu', department: 'Mathematics', year: '1st' },
  { name: 'Kabir Singh', email: 'kabir@demo.edu', department: 'Mechanical', year: '4th' },
  { name: 'Sneha Patil', email: 'sneha@demo.edu', department: 'Business', year: '2nd' },
];

// owner / members are indexes into `people`
const groups = [
  {
    name: 'DBMS Exam Prep', subject: 'Databases', department: 'Computer Science', owner: 0, members: [0, 1, 2, 3],
    description: 'Normalization, SQL practice and last-year papers before the end-sem.',
    chat: [
      [0, 'Welcome everyone! Share your doubts here and we will go through them together.', 'announce'],
      [1, 'Can someone explain the difference between 3NF and BCNF with an example?'],
      [0, 'Sure. In 3NF a non-key attribute may depend on another non-key attribute only if it is prime. BCNF removes even that exception.'],
      [2, 'Posting the ER diagram practice set tonight.'],
      [0, 'Mock test this Sunday 6 PM on the group call. Topics: joins, indexing, transactions.', 'announce'],
    ],
  },
  {
    name: 'DSA Daily Challenge', subject: 'Data Structures', department: 'Computer Science', owner: 1, members: [1, 0, 3],
    description: 'One problem a day. Post your approach, compare complexity, learn faster.',
    chat: [
      [1, 'Rule: post your approach before looking at solutions. No spoilers!', 'announce'],
      [0, 'Today: two-sum variants with a hash map. Anyone solved it in O(1) extra space?'],
      [3, 'Not possible unless the array is sorted, then two pointers works.'],
    ],
  },
  {
    name: 'Calculus & Linear Algebra Help', subject: 'Mathematics', department: 'Mathematics', owner: 3, members: [3, 1, 2, 4],
    description: 'Weekly problem solving sessions for first and second years.',
    chat: [
      [3, 'Doubt session every Wednesday at 5 PM in the library discussion room.', 'announce'],
      [4, 'How do I quickly find eigenvalues of a 3x3 matrix in the exam?'],
      [3, 'Use the characteristic polynomial and check for easy roots like 1, -1, 2 first.'],
    ],
  },
  {
    name: 'Digital Electronics Lab Buddies', subject: 'Digital Electronics', department: 'Electronics', owner: 2, members: [2, 0, 4],
    description: 'Lab viva questions, circuit debugging and breadboard tips.',
    chat: [
      [2, 'Viva question bank for flip-flops and counters uploaded soon.', 'announce'],
      [4, 'Our JK flip-flop keeps toggling randomly. Any idea?'],
      [2, 'Check for race-around: use a master-slave design or edge triggering.'],
    ],
  },
  {
    name: 'Thermodynamics Study Circle', subject: 'Thermodynamics', department: 'Mechanical', owner: 4, members: [4, 2],
    description: 'Cycle analysis, steam tables and numericals for mechanical branch.',
    chat: [[4, 'Starting with Carnot and Rankine cycles this week. Bring your steam tables.', 'announce']],
  },
  {
    name: 'Marketing Case Study Club', subject: 'Marketing', department: 'Business', owner: 5, members: [5, 3, 1],
    description: 'Discuss real business cases, prepare presentations and practice pitching.',
    chat: [
      [5, 'First case: how a local brand won against a national competitor. Read before Friday.', 'announce'],
      [3, 'Happy to join. Which framework should we use, SWOT or 4Ps?'],
      [5, 'Start with 4Ps, then add SWOT for the conclusion.'],
    ],
  },
  {
    name: 'Operating Systems Revision', subject: 'Operating Systems', department: 'Computer Science', owner: 0, members: [0, 1, 2],
    description: 'Scheduling, deadlocks, memory management and paging numericals.',
    chat: [[0, 'Cheat sheet for CPU scheduling algorithms coming up. Add what you have!', 'announce']],
  },
  {
    name: 'Placement Prep Hub', subject: 'Interview Preparation', department: 'General', owner: 1, members: [1, 0, 2, 3, 4, 5],
    description: 'Aptitude, coding rounds, resumes and mock interviews for all departments.',
    chat: [
      [1, 'Weekly mock interview slots open. Reply here to book one.', 'announce'],
      [5, 'I would like a slot for HR round practice.'],
      [1, 'Booked for Thursday 4 PM.'],
    ],
  },
];

(async () => {
  await mongoose.connect(MONGO_URI);

  // remove earlier demo data so the script can be run repeatedly
  const old = await User.find({ email: /@demo\.edu$/ });
  const oldIds = old.map((u) => u._id);
  const oldGroups = await Group.find({ owner: { $in: oldIds } });
  await Message.deleteMany({ group: { $in: oldGroups.map((g) => g._id) } });
  await Group.deleteMany({ _id: { $in: oldGroups.map((g) => g._id) } });
  await User.deleteMany({ _id: { $in: oldIds } });

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = await User.insertMany(people.map((p) => ({ ...p, password: hash })));

  let minutesAgo = groups.reduce((n, g) => n + g.chat.length, 0) * 20;
  for (const g of groups) {
    const doc = await Group.create({
      name: g.name,
      subject: g.subject,
      department: g.department,
      description: g.description,
      owner: users[g.owner]._id,
      members: g.members.map((i) => users[i]._id),
    });
    for (const [who, text, kind] of g.chat) {
      const when = new Date(Date.now() - minutesAgo * 60 * 1000);
      minutesAgo -= 20;
      await Message.create({
        group: doc._id,
        sender: users[who]._id,
        text,
        isAnnouncement: kind === 'announce',
        pinned: kind === 'announce',
        createdAt: when,
        updatedAt: when,
      });
    }
  }

  console.log(`Seeded ${users.length} demo users and ${groups.length} groups.\n`);
  console.log('Demo logins (password for all: ' + DEMO_PASSWORD + '):');
  people.forEach((p) => console.log(`  ${p.email.padEnd(18)} ${p.name} (${p.department})`));
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
