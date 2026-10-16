// Lifts the product out of each studio panel onto a transparent background, with the same
// subject cut-out Photos uses (Apple's Vision framework, on this Mac; nothing is downloaded).
// macOS 14 or later. Run from the repo root through scripts/colorway-cutouts.mjs, which prepares
// the inputs and turns the results into WebP:
//   swift scripts/cutout.swift <input image> <output png> [<input> <output> ...]
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

func cutOut(_ input: URL, to output: URL) throws {
  guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else { throw NSError(domain: "cutout", code: 1, userInfo: [NSLocalizedDescriptionKey: "Can't read \(input.path)"]) }

  let request = VNGenerateForegroundInstanceMaskRequest()
  let handler = VNImageRequestHandler(cgImage: image)
  try handler.perform([request])
  guard let result = request.results?.first else {
    throw NSError(domain: "cutout", code: 2, userInfo: [NSLocalizedDescriptionKey: "No subject found in \(input.path)"])
  }
  // Every subject found (the device, or the case's lid and base), at the input's full size.
  let masked = try result.generateMaskedImage(
    ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)

  let context = CIContext()
  let ci = CIImage(cvPixelBuffer: masked)
  guard let cg = context.createCGImage(ci, from: ci.extent),
    let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)
  else { throw NSError(domain: "cutout", code: 3, userInfo: [NSLocalizedDescriptionKey: "Can't write \(output.path)"]) }
  CGImageDestinationAddImage(dest, cg, nil)
  guard CGImageDestinationFinalize(dest) else {
    throw NSError(domain: "cutout", code: 4, userInfo: [NSLocalizedDescriptionKey: "Can't write \(output.path)"])
  }
}

let args = Array(CommandLine.arguments.dropFirst())
guard !args.isEmpty, args.count % 2 == 0 else {
  FileHandle.standardError.write("usage: swift scripts/cutout.swift <input> <output.png> [...]\n".data(using: .utf8)!)
  exit(64)
}
for i in stride(from: 0, to: args.count, by: 2) {
  do {
    try cutOut(URL(fileURLWithPath: args[i]), to: URL(fileURLWithPath: args[i + 1]))
    print(args[i + 1])
  } catch {
    FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
    exit(1)
  }
}
