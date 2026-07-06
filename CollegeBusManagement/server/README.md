# College Bus Management — Server

Express + MongoDB (Mongoose) backend for the College Bus Management System.

## Setup

```bash
cd server
npm install
```

Edit `.env` and set:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/college_bus_management
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
```

You need a running MongoDB instance — either local (`mongod`) or a connection
string from MongoDB Atlas.

## Run

```bash
npm run dev     # nodemon, auto-restarts on file changes
npm start       # plain node
```

The API runs at `http://localhost:5000`.

## API overview

| Resource | Base path      | Notes                                   |
|----------|----------------|------------------------------------------|
| Admin    | `/api/admin`   | register, login, view students/complaints |
| Student  | `/api/student` | register, login, profile, complaints    |
| Bus      | `/api/bus`     | CRUD, admin-only writes                 |
| Driver   | `/api/driver`  | admin creates drivers, drivers log in   |
| Route    | `/api/route`   | CRUD, admin-only writes                 |

Protected routes expect `Authorization: Bearer <token>`, where the token comes
from the login/register response.
