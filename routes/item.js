const { request, query } = require('express');
const { body, validationResult } = require('express-validator');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const conn = require('../db/dbConnection');
const dotenv = require('dotenv').config();
const router = require('express').Router();
const upload = require('../uploadImages');
const util = require('util');
const fs = require('fs');
const crypto = require('crypto');
const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
});
const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString('hex');

const imageName = randomImageName();

//create item

router.post(
  '',
  upload.single('image'),
  body('title')
    .isString()
    .withMessage('please enter a valid name')
    .isLength({
      min: 5,
    })
    .withMessage('title should have 5 characters atleast'),

  body('price').isNumeric().withMessage('please enter a valid price'),
  body('description')
    .isString()
    .withMessage('please enter a valid description'),
  // .isLength({
  //   min: 10,
  // })
  // .withMessage('description should be more than 5 letters'),
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
              msg: 'Image is required',
            },
          ],
        });
      }
      const bucketParams = {
        Bucket: bucketName,
        Key: imageName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const command = new PutObjectCommand(bucketParams);
      await s3.send(command);

      const item = {
        title: req.body.title,
        price: req.body.price,
        description: req.body.description,
        image_url: imageName,
        categoriesID: req.body.categoriesID,
        subcategoriesID: req.body.subcategoriesID,
      };

      const query = util.promisify(conn.query).bind(conn);
      await query('insert into items set ?', item);
      res.status(200).json(req.file);
    } catch (err) {
      res.status(500).json(err);
      console.log(err);
    }
  }
);

//edit items
router.put(
  '/:id',
  upload.single('image'),
  // body('title')
  //   .isString()
  //   .withMessage('please enter a valid name')
  //   .isLength({
  //     min: 5,
  //   })
  //   .withMessage('title should have 5 characters atleast'),

  // body('price').isNumeric().withMessage('please enter a valid price'),
  // body('description')
  //   .isString()
  //   .withMessage('please enter a valid description'),
  async (req, res) => {
    try {
      const query = util.promisify(conn.query).bind(conn);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const item = await query('select * from items where id = ?', [
        req.params.id,
      ]);

      if (!item[0]) {
        req.status(404).json({
          msg: 'item not found !!',
        });
      }

      const itemObj = {
        title: req.body.title,
        price: req.body.price,
        description: req.body.description,
        subcategoriesID: req.body.subcategoriesID,
        categoriesID: req.body.categoriesID,
      };

      if (req.file) {
        itemObj.image_url = req.file.filename;
        fs.unlinkSync('./upload/' + item[0].image_url);
      }

      await query('update items set ? where id = ?', [itemObj, item[0].id]);

      res.status(200).json({
        msg: 'item updated successfully',
      });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);

//delete item
router.delete('/:id', async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn);
    const item = await query('select * from items where id = ?', [
      req.params.id,
    ]);
    if (!item[0]) {
      req.status(404).json({
        msg: 'item not found !!',
      });
    }
    const params = {
      Bucket: bucketName,
      Key: item[0].image_url,
    };

    // if (item[0].image_url.length) {
    //   fs.unlinkSync("./upload/" + item[0].image_url);
    // }

    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    await query('delete from items where id = ?', [item[0].id]);

    res.status(200).json({
      msg: 'item deleted successfully',
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

//get items
// router.get("", async (req, res) => {
//   const query = util.promisify(conn.query).bind(conn);
//
//   items.map((item) => {
//     item.image_url = "http://" + req.hostname + ":4000/" + item.image_url;
//   });
//   res.status(200).json(items);
// }

async function check(condition, queryName) {
  const query = util.promisify(conn.query).bind(conn);
  if (condition) {
    const items = await query('select * from items');
    return items;
  } else {
    const subcategoriesID = await query(
      'select id from subcategories where name = ?',
      [queryName]
    );
    const items = await query('select * from items where subcategoriesID = ?', [
      subcategoriesID[0].id,
    ]);
    return items;
  }
}

//get item based on condition
router.get('', async (req, res) => {
  const query = util.promisify(conn.query).bind(conn);

  let condition = Object.keys(req.query).length == 0;
  const queryName = req.query.name;
  const items = await check(condition, queryName);

  for (const item of items) {
    const getObjectsParams = {
      Bucket: bucketName,
      Key: item.image_url,
    };
    const command = new GetObjectCommand(getObjectsParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    item.image_url = url;
    console.log(url, item.image_url);
  }

  // items.map((item) => {
  //   item.image_url = 'http://' + req.hostname + ':4000/' + item.image_url;
  // });
  res.status(200).json(items);
});

router.get('/:id', async (req, res) => {
  const query = util.promisify(conn.query).bind(conn);
  const item = await query('select * from items where id = ?', [req.params.id]);
  if (!item[0]) {
    res.status(404).json({
      msg: 'item not found !!',
    });
  }

  const getObjectsParams = {
    Bucket: bucketName,
    Key: item[0]?.image_url,
  };

  const command = new GetObjectCommand(getObjectsParams);
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  item[0].image_url = url;

  res.status(200).json(item);
});

module.exports = router;
