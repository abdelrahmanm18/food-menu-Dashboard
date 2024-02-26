const { request, query } = require("express");
const { body, validationResult } = require("express-validator");
const router = require("express").Router();
const conn = require("../db/dbConnection");
const upload = require("../uploadImages");
const util = require("util");
const fs = require("fs");

//create categories
router.post(
  "",
  upload.single("image"),
  body("name")
    .isString()
    .withMessage("please enter a valid name")
    .isLength({
      min: 5,
    })
    .withMessage("name should have 5 characters atleast"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.file) {
        return res.status(400).json({
          errors: [
            {
              msg: "Image is required",
            },
          ],
        });
      }

      const category = {
        name: req.body.name,
        image_url: req.file.filename,
      };

      const query = util.promisify(conn.query).bind(conn);
      await query("insert into categories set ?", category);
      res.status(200).json(req.file);
    } catch (err) {
      res.status(500).json(err);
    }
  }
);

//edit categories
router.put(
  "/:id",
  upload.single("image"),
  body("name")
    .isString()
    .withMessage("please enter a valid name")
    .isLength({
      min: 5,
    })
    .withMessage("title should have 5 characters atleast"),

  async (req, res) => {
    try {
      const query = util.promisify(conn.query).bind(conn);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log(errors);
        return res.status(400).json({ errors: errors.array() });
      }

      const category = await query("select * from categories where id = ?", [
        req.params.id,
      ]);

      if (!category[0]) {
        req.status(404).json({
          msg: "category not found !!",
        });
      }

      const categoryObj = {
        name: req.body.name,
      };

      if (req.file) {
        categoryObj.image_url = req.file.filename;
        fs.unlinkSync("./upload/" + category[0].image_url);
      }

      await query("update categories set ? where id = ?", [
        categoryObj,
        category[0].id,
      ]);

      res.status(200).json({
        msg: "category updated successfully",
      });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);

//delete categories
router.delete("/:id", async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn);
    const category = await query("select * from categories where id = ?", [
      req.params.id,
    ]);
    console.log(category);

    if (!category[0]) {
      req.status(404).json({
        msg: "category not found !!",
      });
    }

    fs.unlinkSync("./upload/" + category[0].image_url);

    await query("delete from categories where id = ?", [category[0].id]);

    res.status(200).json({
      msg: "category deleted successfully",
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

//get categories
router.get("", async (req, res) => {
  const query = util.promisify(conn.query).bind(conn);
  const categories = await query("select * from categories");
  categories.map((category) => {
    category.image_url =
      "http://" + req.hostname + ":4000/" + category.image_url;
  });
  res.status(200).json(categories);
});

module.exports = router;
