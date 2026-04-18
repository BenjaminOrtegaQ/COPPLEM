"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = require("node:crypto");
function timingSafeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let r = 0;
    for (let i = 0; i < a.length; i++)
        r |= a[i] ^ b[i];
    return r === 0;
}
function hashPassword(password, iterations = 200_000) {
    const salt = (0, node_crypto_1.randomBytes)(16);
    const dk = (0, node_crypto_1.pbkdf2Sync)(password, salt, iterations, 32, "sha256");
    return `pbkdf2_sha256$${iterations}$${salt.toString("base64")}$${dk.toString("base64")}`;
}
function verifyPassword(password, stored) {
    try {
        const [algo, itersStr, b64salt, b64hash] = stored.split("$");
        if (algo !== "pbkdf2_sha256")
            return false;
        const iterations = parseInt(itersStr, 10);
        const salt = Buffer.from(b64salt, "base64");
        const expected = Buffer.from(b64hash, "base64");
        const dk = (0, node_crypto_1.pbkdf2Sync)(password, salt, iterations, expected.length, "sha256");
        return timingSafeEqual(dk, expected);
    }
    catch {
        return false;
    }
}
