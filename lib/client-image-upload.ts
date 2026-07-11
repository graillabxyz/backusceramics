function isHeicFile(file: File) {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif")
}

async function loadBrowserImage(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = objectUrl
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function prepareImageForUpload(file: File) {
  if (!isHeicFile(file) || typeof document === "undefined") return file

  const image = await loadBrowserImage(file)
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
  const scale = Math.min(2400 / Math.max(longestSide, 1), 1)
  const width = Math.max(Math.round(image.naturalWidth * scale), 1)
  const height = Math.max(Math.round(image.naturalHeight * scale), 1)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("This browser could not prepare the HEIC image")

  context.drawImage(image, 0, 0, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("This browser could not convert the HEIC image")),
      "image/jpeg",
      0.92
    )
  })

  const convertedName = file.name.replace(/\.(heic|heif)$/i, "") || "image"
  return new File([blob], `${convertedName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified })
}
