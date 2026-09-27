const express = require("express");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const multer = require("multer");
const session = require("express-session");

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, "uploads");
const databaseFile = path.join(__dirname, "database.sqlite");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "umucyo-secret-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const name =
        Date.now() +
        "-" +
        file.originalname.replace(
          /[^a-zA-Z0-9.-]/g,
          "_"
        );

      cb(null, name);
    }
  })
});

let db;

function saveDatabase() {
  fs.writeFileSync(
    databaseFile,
    Buffer.from(db.export())
  );
}

function rowsToObjects(result) {
  if (!result.length) return [];

  return result[0].values.map(row => {
    const item = {};

    result[0].columns.forEach((column, i) => {
      item[column] = row[i];
    });

    return item;
  });
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(401).json({
      error: "Admin login required."
    });
  }

  next();
}

async function start() {
  const SQL = await initSqlJs();

  if (
    fs.existsSync(databaseFile) &&
    fs.statSync(databaseFile).size > 0
  ) {
    try {
      db = new SQL.Database(
        fs.readFileSync(databaseFile)
      );
    } catch (error) {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image TEXT,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      published INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDatabase();

  app.get("/api/articles", (req, res) => {
    const result = db.exec(`
      SELECT *
      FROM articles
      WHERE published = 1
      ORDER BY id DESC
    `);

    res.json(rowsToObjects(result));
  });

  app.get("/api/articles/:id", (req, res) => {
    const id = Number(req.params.id);

    const stmt = db.prepare(
      "SELECT * FROM articles WHERE id = ?"
    );

    stmt.bind([id]);

    if (!stmt.step()) {
      stmt.free();

      return res.status(404).json({
        error: "Article not found"
      });
    }

    const article = stmt.getAsObject();

    stmt.free();

    res.json(article);
  });

  app.get(
    "/api/articles/:id/comments",
    (req, res) => {
      const articleId = Number(req.params.id);

      const result = db.exec(`
        SELECT *
        FROM comments
        WHERE article_id = ${articleId}
        ORDER BY id DESC
      `);

      res.json(rowsToObjects(result));
    }
  );

  app.post(
    "/api/articles/:id/comments",
    (req, res) => {
      const articleId = Number(req.params.id);
      const { name, comment } = req.body;

      if (!name || !comment) {
        return res.status(400).json({
          error:
            "Please enter your name and comment."
        });
      }

      db.run(
        `
        INSERT INTO comments
        (article_id, name, comment)
        VALUES (?, ?, ?)
        `,
        [
          articleId,
          name.trim(),
          comment.trim()
        ]
      );

      saveDatabase();

      res.json({
        success: true,
        message: "Comment posted."
      });
    }
  );

  app.post(
    "/api/admin/login",
    (req, res) => {
      const { password } = req.body;

      if (
        password &&
        password === process.env.ADMIN_PASSWORD
      ) {
        req.session.isAdmin = true;

        return res.json({
          success: true
        });
      }

      res.status(401).json({
        success: false,
        error: "Incorrect password."
      });
    }
  );

  app.post(
    "/api/admin/logout",
    (req, res) => {
      req.session.destroy(() => {
        res.json({
          success: true
        });
      });
    }
  );

  app.get("/api/admin/status", (req, res) => {
    res.json({
      loggedIn: !!req.session.isAdmin
    });
  });

  app.post(
    "/api/articles",
    requireAdmin,
    upload.single("image"),
    (req, res) => {
      const {
        title,
        category,
        content,
        author
      } = req.body;

      if (
        !title ||
        !category ||
        !content ||
        !author
      ) {
        return res.status(400).json({
          error: "Please fill in all fields."
        });
      }

      const image = req.file
        ? "/uploads/" + req.file.filename
        : "";

      db.run(
        `
        INSERT INTO articles
        (title, category, image, content, author)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          title,
          category,
          image,
          content,
          author
        ]
      );

      saveDatabase();

      res.json({
        success: true,
        message: "Article published."
      });
    }
  );

  app.delete(
    "/api/articles/:id",
    requireAdmin,
    (req, res) => {
      const id = Number(req.params.id);

      db.run(
        "DELETE FROM articles WHERE id = ?",
        [id]
      );

      saveDatabase();

      res.json({
        success: true
      });
    }
  );

  app.get("/admin", (req, res) => {
    if (!req.session.isAdmin) {
      return res.sendFile(
        path.join(
          __dirname,
          "public",
          "login.html"
        )
      );
    }

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "admin.html"
      )
    );
  });

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log("");
      console.log(
        "================================"
      );
      console.log(
        "          UMUCYO NEWS"
      );
      console.log(
        "================================"
      );
      console.log(
        "Website: http://127.0.0.1:" +
          PORT
      );
      console.log(
        "Admin:   http://127.0.0.1:" +
          PORT +
          "/admin"
      );
      console.log(
        "================================"
      );
      console.log(
        "Server is running!"
      );
      console.log("");
    }
  );
}

start().catch(error => {
  console.error("SERVER ERROR:");
  console.error(error);

});
