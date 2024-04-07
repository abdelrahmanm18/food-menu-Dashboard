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
const util = require('util');
const fs = require('fs');
const crypto = require('crypto');
const upload = require('../uploadImages');
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

const randomImageName = (bytes = 16) =>
  crypto.randomBytes(bytes).toString('hex');

//create offer
router.post(
  '',
  upload.single('image'),

  // body('title')
  //   .isString()
  //   .withMessage('please enter a valid name')
  //   .isLength({
  //     min: 5,
  //   })
  //   .withMessage('title should have 5 characters atleast'),

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

      const imageName = randomImageName();

      const bucketParams = {
        Bucket: bucketName,
        Key: imageName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const command = new PutObjectCommand(bucketParams);
      await s3.send(command);

      const offer = {
        title: req.body.title,
        available: req.body.available,
        image_url: imageName,
      };

      const query = util.promisify(conn.query).bind(conn);
      await query('insert into offers set ?', offer);
      res.status(200).json(offer);
    } catch (err) {
      res.status(500).json(err);
      console.log(err);
    }
  }
);

router.get('', async (req, res) => {
  const query = util.promisify(conn.query).bind(conn);
  const offers = await query('select * from offers');

  for (const offer of offers) {
    const getObjectsParams = {
      Bucket: bucketName,
      Key: offer.image_url,
    };

    const command = new GetObjectCommand(getObjectsParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    offer.image_url = url;
  }
  res.status(200).json(offers);
});

router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn);
    const queryValue = req.query.available;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const offer = await query('select * from offers where id = ?', [
      req.params.id,
    ]);

    if (!offer[0]) {
      req.status(404).json({
        msg: 'offer not found !!',
      });
    }

    const offerObj = {};

    if (queryValue) {
      offerObj.available = queryValue;
    } else {
      offerObj.title = req.body.title;
      offerObj.available = req.body.available;
    }

    // const offerObj = {
    //   title: req.body.title,
    //   available: req.body.available,
    // };

    if (req.file) {
      const deletedImageparams = {
        Bucket: bucketName,
        Key: offer[0].image_url,
      };

      const deleteCommand = new DeleteObjectCommand(deletedImageparams);
      await s3.send(deleteCommand);

      const imageName = randomImageName();

      const bucketParams = {
        Bucket: bucketName,
        Key: imageName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const putCommand = new PutObjectCommand(bucketParams);
      await s3.send(putCommand);

      offerObj.image_url = imageName;
    }

    await query('update offers set ? where id = ?', [offerObj, offer[0].id]);

    res.status(200).json({
      msg: 'offer updated successfully',
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.put('/:id/');

module.exports = router;
