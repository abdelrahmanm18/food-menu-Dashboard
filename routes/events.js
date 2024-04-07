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

//create event
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

      const event = {
        title: req.body.title,
        image_url: imageName,
      };

      const query = util.promisify(conn.query).bind(conn);
      await query('insert into events set ?', event);
      res.status(200).json(event);
    } catch (err) {
      res.status(500).json(err);
      console.log(err);
    }
  }
);

router.get('', async (req, res) => {
  const query = util.promisify(conn.query).bind(conn);
  const events = await query('select * from events');

  for (const event of events) {
    const getObjectsParams = {
      Bucket: bucketName,
      Key: event.image_url,
    };

    const command = new GetObjectCommand(getObjectsParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    event.image_url = url;
  }
  res.status(200).json(events);
});

router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn);
    const queryValue = req.query.available;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    }

    const event = await query('select * from events where id = ?', [
      req.params.id,
    ]);

    if (!event[0]) {
      res.status(404).json({ msg: 'event not found!!' });
    }

    const eventObj = {};

    if (queryValue) {
      eventObj.available = queryValue;
    } else {
      eventObj.title = req.body.title;
      eventObj.description = req.body.description;
      eventObj.available = req.body.available;
    }

    if (req.file) {
      const deletedImageparams = {
        Bucket: bucketName,
        Key: event[0].image_url,
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

      eventObj.image_url = imageName;
    }

    const events = await query('update events set ? where id = ?', [
      eventObj,
      event[0].id,
    ]);

    res.status(200).json({
      msg: 'event updated successfully',
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

module.exports = router;
