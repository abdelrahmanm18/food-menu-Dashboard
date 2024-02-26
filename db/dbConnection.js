const mysql = require("mysql");

const connection = mysql.createPool({
  connectionLimit: 10,
  connectTimeout: 10000,
  host: "141.136.33.1",
  user: "u149827998_root",
  password: "saifsaif12SF",
  database: "u149827998_food_store",
  port: "3306",
});

connection.getConnection((err) => {
  if (err) throw err;
  console.log("Db connected");
});

module.exports = connection;
