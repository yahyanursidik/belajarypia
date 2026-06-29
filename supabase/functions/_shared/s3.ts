const encoder = new TextEncoder();

export function requiredEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}

export async function createS3SignedUrl({
  method,
  objectKey,
  contentType,
  acl,
}: {
  method: "GET" | "PUT";
  objectKey: string;
  contentType?: string;
  acl?: string;
}) {
  const endpoint = requiredEnv("S3_ENDPOINT").replace(/\/+$/g, "");
  const region = Deno.env.get("S3_REGION") ?? "us-east-1";
  const bucket = requiredEnv("S3_BUCKET");
  const accessKeyId = requiredEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("S3_SECRET_ACCESS_KEY");
  const expires = Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900";
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(endpoint).host;
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const canonicalUri = `/${bucket}/${encodedKey}`;
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  
  let signedHeaders = method === "PUT" ? "content-type;host" : "host";
  if (acl && method === "PUT") {
    signedHeaders = "content-type;host;x-amz-acl";
  }
  
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": signedHeaders,
  });
  
  const canonicalQueryString = query.toString().replace(/\+/g, "%20");
  
  let canonicalHeaders = method === "PUT"
    ? `content-type:${contentType || "application/octet-stream"}\nhost:${host}\n`
    : `host:${host}\n`;
    
  if (acl && method === "PUT") {
    canonicalHeaders = `content-type:${contentType || "application/octet-stream"}\nhost:${host}\nx-amz-acl:${acl}\n`;
  }
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, "s3");
  const signature = await hmacHex(signingKey, stringToSign);

  return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(hash);
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

async function hmacHex(key: ArrayBuffer | Uint8Array, value: string) {
  return toHex(await hmac(key, value));
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
) {
  const kDate = await hmac(encoder.encode(`AWS4${key}`), dateStamp);
  const kRegion = await hmac(kDate, regionName);
  const kService = await hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
