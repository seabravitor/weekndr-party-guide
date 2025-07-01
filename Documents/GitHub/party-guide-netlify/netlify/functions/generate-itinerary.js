const PDFDocument = require("pdfkit");
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);
    const { city, nights, area = "central", interests, genres, budget = "not specified" } = data;

    if (!city || !nights || !interests || !genres) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields." }),
      };
    }

    const prompt = `
Generate a nightlife itinerary in ${city} for ${nights}.
Staying in: ${area}.
Looking for: ${interests.join(", ")}.
Preferred genres: ${genres.join(", ")}.
Budget: ${budget}.
List suggestions by day. Recommend real venues and acts, when possible.
`;

    const completion = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You're an expert local nightlife guide." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
    });

    const itinerary = completion.data.choices[0].message.content;

    const doc = new PDFDocument();
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {});

    doc.font("Times-Roman").fontSize(12);
    itinerary.split("\n").forEach(line => doc.text(line));
    doc.end();

    await new Promise(resolve => doc.on("end", resolve));
    const pdfBuffer = Buffer.concat(buffers);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=nightlife_guide.pdf",
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error: " + err.message }),
    };
  }
};
