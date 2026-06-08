const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ status: "CallBridge server running" });
});

app.listen(PORT, () => {
  console.log(`CallBridge server started on port ${PORT}`);
});
