const { request, query } = require("express");
const { body, validationResult } = require("express-validator");
const router = require("express").Router();
const conn = require("../db/dbConnection");
const upload = require("../uploadImages");
const util = require("util");
const fs = require("fs");

//create subCategories
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

      const subCategory = {
        name: req.body.name,
        image_url: req.file.filename,
      };

      console.log(subCategory);
      const query = util.promisify(conn.query).bind(conn);
      await query("insert into subcategories set ?", subCategory);
      res.status(200).json(req.file);
    } catch (err) {
      res.status(500).json(err);
    }
  }
);

//edit subcategories
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

      const subcategory = await query(
        "select * from subcategories where id = ?",
        [req.params.id]
      );

      if (!subcategory[0]) {
        req.status(404).json({
          msg: "subcategory not found !!",
        });
      }

      const subcategoryObj = {
        name: req.body.name,
      };

      if (req.file) {
        subcategoryObj.image_url = req.file.filename;
        fs.unlinkSync("./upload/" + subcategoryObj[0].image_url);
      }

      await query("update subcategories set ? where id = ?", [
        subcategoryObj,
        subcategory[0].id,
      ]);

      res.status(200).json({
        msg: "subcategory updated successfully",
      });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);

//delete subcategories
router.delete("/:id", async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn);
    const subcategory = await query(
      "select * from subcategories where id = ?",
      [req.params.id]
    );
    console.log(subcategory);
    if (!subcategory[0]) {
      req.status(404).json({
        msg: "subcategory not found !!",
      });
    }

    console.log(subcategory[0].image_url);
    fs.unlinkSync("./upload/" + subcategory[0].image_url);

    await query("delete from subcategories where id = ?", [subcategory[0].id]);

    res.status(200).json({
      msg: "subcategory deleted successfully",
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

//get categories
// router.get("", async (req, res) => {
//   const query = util.promisify(conn.query).bind(conn);
//   const subCategories = await query("select * from subcategories");
//   subCategories.map((category) => {
//     category.image_url =
//       "http://" + req.hostname + ":4000/" + category.image_url;
//   });
//   res.status(200).json(subCategories);
// });

async function check(condition, queryName) {
  const query = util.promisify(conn.query).bind(conn);
  if (condition) {
    const subCategories = await query("select * from subcategories");
    return subCategories;
  } else {
    const categoriesID = await query(
      "select id from categories where name = ?",
      [queryName]
    );
    const subCategories = await query(
      "select * from subcategories where category_id = ?",
      [categoriesID[0].id]
    );
    return subCategories;
  }
}

//get item based on condition
router.get("", async (req, res) => {
  const query = util.promisify(conn.query).bind(conn);

  let condition = Object.keys(req.query).length == 0;
  const queryName = req.query.name;
  const subCategories = await check(condition, queryName);

  subCategories.map((subcategory) => {
    subcategory.image_url =
      "http://" + req.hostname + ":4000/" + subcategory.image_url;
  });
  res.status(200).json(subCategories);
});

module.exports = router;
