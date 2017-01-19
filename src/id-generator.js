function generateRandomId(length) {
  let chars = "abcdefghjkmnpqrtuvwxyz23456789";
  let id = "";
  while (id.length < length) {
    let index = Math.floor(Math.random() * chars.length);
    id += chars[index];
  }
  return id;
}

exports.generateRandomId = generateRandomId