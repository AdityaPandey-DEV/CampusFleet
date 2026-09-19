const { createWorker } = require('tesseract.js');
async function run() {
  try {
    const worker = await createWorker("eng", 1, {
      workerPath: "./public/tesseract/worker.min.js",
      corePath: "./public/tesseract/tesseract-core.wasm.js",
      langPath: "./public/tesseract/lang-data",
    });
    console.log("Worker created successfully");
    await worker.terminate();
  } catch (err) {
    console.error("Error creating worker:", err);
  }
}
run();
