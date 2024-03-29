const express = require("express");
const router = express.Router();
const { TextEncoder } = require("util");
const fetch = require("node-fetch");

import { Storage, NodeType, getExtension, identify } from "../models/storage";

router.post("/", (req, res) => {
  const user = req.user;
  const id = user.id;
  const key = user.key;

  const storage = new Storage(id, key);

  return res.status(200).json({
    tree: storage.export(),
    types: NodeType,
  });
});

router.post("/read", async (req, res) => {
  const user = req.user;
  const localPath = req.body.localPath;
  const id = user.id;
  const key = user.key;

  const storage = new Storage(id, key);

  const pathParts = localPath.split("/");
  const fileName = pathParts[pathParts.length - 1];
  const extension = getExtension(fileName);
  let data = Buffer.from(storage.readFile(localPath));

  if (
    !(
      identify(extension) & NodeType.IMAGE ||
      identify(extension) & NodeType.VIDEO
    )
  ) {
    data = data.toString("utf8");
  } else {
    data = data.toString("base64");
  }

  return res.status(200).json({
    path: localPath,
    file: fileName,
    extension: extension,
    type: identify(extension),
    data: data,
    lines: data.toString("utf8").split("\n").length,
    size: new TextEncoder().encode(data.toString("utf8")).length,
    types: NodeType,
  });
});

router.post("/write", async (req, res, next) => {
  const user = req.user;
  const localPath = req.body.localPath;
  const type = req.body.type;
  const data = req.body.data;
  const id = user.id;
  const key = user.key;

  const storage = new Storage(id, key);

  let err = new Error("Could not write file");
  err.status = 400;

  if (type & NodeType.FILE) {
    if (!storage.writeFile(localPath, data)) return next(err);
  } else if (type & NodeType.DIR) {
    if (!storage.createDir(localPath)) return next(err);
  } else {
    let err = new Error("Invalid type");
    err.status = 400;
    return next(err);
  }

  return res.status(201).json({
    path: localPath,
  });
});

const multer = require("multer");
const upload = multer();

router.post("/upload", upload.array("files"), async (req, res, next) => {
  const user = req.user;
  const localPath = req.headers["local-path"];
  const files = req.files;
  const id = user.id;
  const key = user.key;

  const storage = new Storage(id, key);

  let err = new Error("Could not upload file");
  err.status = 400;

  for (const file of files)
    if (
      !storage.writeFile(
        `${localPath}${localPath !== "" ? "/" : ""}${file.originalname}`,
        file.buffer
      )
    )
      return next(err);

  return res.status(201).json({
    uploaded: true,
  });
});

let retryFetch = async (url, t) => {
  try {
    return await fetch(url);
  } catch (_) {
    await new Promise((resolve) => setTimeout(resolve, t * 1000));
    return await retryFetch(url, t + 1);
  }
};

router.post("/uploadFromURL", async (req, res, next) => {
  const user = req.user;
  const localPath = req.body.localPath;
  const url = req.body.url;
  const id = user.id;
  const key = user.key;

  const storage = new Storage(id, key);

  const fileName = url.split("/").pop();

  if (
    storage.readFile(
      `${localPath}${localPath !== "" ? "/" : ""}${fileName}`
    ) !== ""
  ) {
    let err = new Error("File already exists");
    err.status = 400;
    return next(err);
  }

  const fileRes = await retryFetch(url, 1);
  const data = await fileRes.buffer();

  if (
    !storage.writeFile(
      `${localPath}${localPath !== "" ? "/" : ""}${fileName}`,
      data
    )
  ) {
    let err = new Error("Could not write file");
    err.status = 400;
    return next(err);
  }

  return res.status(201).json({
    path: localPath,
  });
});

router.post("/delete", async (req, res) => {
  const user = req.user;
  const localPath = req.body.localPath;
  const id = user.id;
  const key = user.key;

  const storage = new Storage(id, key);
  const deleted = storage.delete(localPath);

  return res.status(201).json({
    deleted: deleted,
  });
});

router.post("/rename", async (req, res, next) => {
  const user = req.user;
  const localPath = req.body.localPath;
  const id = user.id;
  const key = user.key;
  const name = req.body.name;

  if (!localPath || !name) {
    let err = new Error("Could not rename file");
    err.status = 400;
    return next(err);
  }

  const storage = new Storage(id, key);
  const renamed = storage.rename(localPath, name);

  return res.status(201).json({
    renamed: renamed,
  });
});

export default router;
