const router = require("express").Router();
const conn = require("../db/dbConnection");
const { body, validationResult } = require("express-validator");
const util = require("util");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

//register
router.post(
  "/register",
  body("email").isEmail().withMessage("please enter a valid email"),
  body("username")
    .isString()
    .withMessage("please enter a valid username")
    .isLength({ min: 8, max: 20 })
    .withMessage("username should be between (8-20) character"),
  body("password")
    .isLength({ min: 8, max: 16 })
    .withMessage("password should be between (8,16) character"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const query = util.promisify(conn.query).bind(conn);
      const checkEmailExists = await query(
        "select * from users where email = ? ",
        [req.body.email]
      );

      if (checkEmailExists.length > 0) {
        res.status(400).json({
          errors: [
            {
              msg: "email already exists!",
            },
          ],
        });
      }

      const userData = {
        username: req.body.username,
        email: req.body.email,
        password: await bcrypt.hash(req.body.password, 10),
        token: crypto.randomUUID(),
      };

      if (checkEmailExists == 0) {
        await query("insert into users set ?", userData);
        res.status(200).json(userData);
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error });
    }
  }
);

module.exports = router;
