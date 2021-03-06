const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");
const app = express();
const User = require("./user");
const Event = require("./event");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const jwt = require("jsonwebtoken");
const pug = require("pug");
const nodemailer = require("nodemailer");
const morgan = require("morgan");
require("dotenv").config();
//----------------------------------------- END OF IMPORTS---------------------------------------------------
mongoose.connect(
  process.env.MONGO_URL,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  },
  (err) => {
    if (err) console.log(err);
    else console.log("Mongoose Is Connected");
  }
);

app.set("views", path.join(__dirname, "views"));

app.set("view engine", "pug");

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.frontendURL, // <-- location of the react app were connecting to
    credentials: true,
  })
);
app.use(
  session({
    secret: "secretcode",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(cookieParser("secretcode"));
app.use(passport.initialize());
app.use(passport.session());
require("./passportConfig")(passport);

app.use(morgan("dev"));
//----------------------------------------- END OF MIDDLEWARE---------------------------------------------------

const secured = (req, res, next) => {
  if (req.user) {
    return next();
  }
  res.redirect("/login");
};

app.get("/", (req, res) => {
  res.send({
    success: "true",
  });
});

// Routes
app.post("/api/login", (req, res, next) => {
  try {
    if (!req.body.email || !req.body.password) {
      return res.send({
        status: 400,
        msg: "Please enter both the fields",
      });
    }
    passport.authenticate("local", (err, user, info) => {
      if (err)
        return res.send({
          status: 409,
          msg: "Login unsuccessful, please try again later!",
        });
      if (!user)
        return res.send({
          status: 400,
          msg: "User with these credentials is not registered!",
        });
      else {
        req.logIn(user, (err) => {
          if (err)
            return res.send({
              status: 409,
              msg: "Login Unsuccessful, please try again later!",
            });
          else
            return res.send({
              status: 200,
              msg: "Successfully logged in",
            });
        });
      }
    })(req, res, next);
  } catch (error) {
    res.send({
      status: 400,
      msg: "Login unsuccessful! Please try again later!",
    });
  }
});

app.post("/api/register/mail", (req, res) => {
  try {
    let email = req.body.email;
    let name = req.body.name;
    let contact = req.body.contact;
    let college = req.body.college;
    let password = req.body.password;

    if (!email || !name || !contact || !college || !password) {
      return res.send({
        status: "409",
        msg: "Please fill all the fields",
      });
    }

    User.findOne({ email }, (err, user) => {
      if (err)
        return res.send({
          status: 409,
          msg: "Registration unsuccessful, please try again later!",
        });
      if (user) {
        return res.json({
          status: 400,
          msg: "User already registered!",
        });
      }
      if (!user) {
        const token = jwt.sign(
          {
            email,
            name,
            contact,
            college,
            password,
          },
          "secret",
          { expiresIn: "1h" }
        );

        let transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "ayanadhya1999@gmail.com",
            pass: "1234ayan",
          },
        });

        let mailOptions = {
          from: "ayanadhya1999@gmail.com",
          to: email,
          subject: "Cepheus Registration",
          html: pug.renderFile(`${__dirname}/views/index.pug`, {
            email,
            name,
            contact,
            college,
            password,
            link: `${process.env.backendURL}/api/confirmregistration/${token}`,
          }),
        };

        transporter.sendMail(mailOptions, (err, info) => {
          console.log(err);
          if (err)
            return res.send({
              status: 409,
              msg: "Registration unsuccessful, please try again later!",
            });
          else {
            return res.send({
              status: 200,
              msg: "Please check your mail and confirm registration!",
            });
          }
        });
      }
    });
  } catch (error) {
    res.send({
      status: 400,
      msg: "Some error occured, please try again later!",
    });
  }
});

app.get("/api/confirmregistration/:token", async (req, res) => {
  try {
    const token = req.params.token;
    jwt.verify(token, "secret", async (err, decoded) => {
      if (err) {
        return res.send({
          status: 409,
          msg: "Registration unsuccessful, please try again later!",
        });
      } else {
        const email = decoded.email;
        const password = decoded.password;
        const college = decoded.college;
        const contact = decoded.contact;
        const name = decoded.name;

        await User.findOne({ email: email }, async (err, doc) => {
          if (err)
            return res.send({
              status: 409,
              msg: "Registration unsuccessful, please try again later!",
            });
          if (doc) res.redirect(`${process.env.frontendURL}/login`);
          if (!doc) {
            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = new User({
              email,
              password: hashedPassword,
              college,
              contact,
              uid: uuidv4(),
              name,
            });
            await newUser.save();
            res.redirect(`${process.env.frontendURL}/login`);
          }
        });
      }
    });
  } catch (error) {
    res.send({
      status: 400,
      msg: "Some error occured! Please try again later!",
    });
  }
});
app.get("/api/user", (req, res) => {
  try {
    return res.send(req.user); // The req.user stores the entire user that has been authenticated inside of it.
  } catch (error) {
    res.send({
      status: 400,
      msg: "Error! Please try again later",
    });
  }
});

app.get("/api/auth", (req, res) => {
  try {
    if (req.isAuthenticated()) {
      return res.send({
        auth: "true",
        user: req.user,
      });
    } else {
      return res.send({
        auth: "false",
      });
    }
  } catch (error) {
    res.send({
      status: 400,
      msg: "Error! Please try again later!",
    });
  }
});

app.get("/logout", function (req, res) {
  try {
    req.logout();
    return res.send("logout successful");
  } catch (error) {
    res.send({
      status: 400,
      msg: "Error! Please try again later!",
    });
  }
});

app.post("/api/:eventName/register", async (req, res) => {
  try {
    let userIds = [];
    console.log(req.body.email);
    if (!req.body || req.body.email.length < 1) {
      return res.send({
        status: 409,
        msg: "Atleast one participant email is required",
      });
    }
    for (var i = 0; i < req.body.email.length; i++) {
      await User.findOne({ email: req.body.email[i] }, (err, user) => {
        console.log(user);
        if (err)
          return res.send({
            status: 409,
            msg: "Registration unsuccessful, please try again later!",
          });
        if (!user) {
          userIds = [];
          return res.send({
            status: 400,
            msg: "One of the users is not registered",
          });
        }
        if (user) {
          userIds.push(user._id);
        }
      });
    }

    if (userIds.length > 0) {
      const options = { upsert: true, new: true, setDefaultsOnInsert: true };

      await Event.findOneAndUpdate(
        { name: req.params.eventName },
        options,
        async (err, doc) => {
          if (err)
            return res.send({
              status: 409,
              msg: "Registration unsuccessful, please try again later!",
            });
          if (!doc) {
            const newEvent = new Event({
              name: req.params.eventName,
              teams: [
                {
                  participants: userIds,
                },
              ],
            });
            await newEvent.save();
            return res.send({
              status: 201,
              msg: "Registration Complete!",
            });
          }
          if (doc) {
            const doc = await Event.findOne({ name: req.params.eventName });

            for (var j = 0; j < doc.teams.length; j++) {
              for (var k = 0; k < doc.teams[j].participants.length; k++) {
                for (var m = 0; m < userIds.length; m++) {
                  if (
                    String(doc.teams[j].participants[k]) === String(userIds[m])
                  ) {
                    return res.send({
                      status: 400,
                      msg: "One of the participants is already registered",
                    });
                  }
                }
              }
            }

            doc.teams.push({
              participants: userIds,
            });
            await doc.save();

            return res.send({
              status: 201,
              msg: "Registration complete!",
            });
          }
        }
      );
    }
  } catch (error) {
    res.send({
      status: 400,
      msg: "Error occured! Please try again later!",
    });
  }
});

//----------------------------------------- END OF ROUTES---------------------------------------------------
//Start Server
PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server Has Started");
});
