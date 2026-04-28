import "server-only"
import ImageKit from "imagekit"

const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT

if (!publicKey || !privateKey || !urlEndpoint) {
  throw new Error(
    "Missing ImageKit env vars (IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT)"
  )
}

export const imagekit = new ImageKit({
  publicKey,
  privateKey,
  urlEndpoint,
})
