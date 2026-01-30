const axios = require("axios");

const config = {
    clientId: "8bb86df9cd0931326e3ecd9d243713d58ee76c57af9a7538d8a7292c86988a98",
    clientSecret: "e34950d3b6994068244f539b893082ef",
    apiUrl: "http://172.16.1.23:83/admin/api/api/gql"
};

async function run() {
    const tokenUrl = config.apiUrl.replace("/gql", "/token");
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    const authHeader = Buffer.from(config.clientId + ":" + config.clientSecret).toString("base64");

    console.log("Fetching token...");
    const tokenRes = await axios.post(tokenUrl, params.toString(), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + authHeader
        }
    });
    const token = tokenRes.data.access_token;
    const headers = {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "Sangoma P330/4.5.3"
    };

    const query = `
    query {
      __schema {
        types {
          name
        }
      }
      RouteInput: __type(name: "addInboundRouteInput") {
        inputFields {
          name
          type {
            name
            kind
            ofType { name kind }
          }
        }
      }
      fetchAllInboundRoutes {
        extension
        cidnum
        destination
      }
    }
    `;

    console.log("Executing GQL query...");
    const res = await axios.post(config.apiUrl, { query }, { headers });

    if (res.data.data) {
        const types = res.data.data.__schema.types.filter(t =>
            t.name.toLowerCase().includes("voicemail") ||
            t.name.toLowerCase().includes("msg") ||
            t.name.toLowerCase().includes("vmail")
        );
        console.log("=== VOICEMAIL TYPES ===");
        console.log(JSON.stringify(types, null, 2));

        console.log("=== ROUTE INPUT SCHEMA ===");
        console.log(JSON.stringify(res.data.data.RouteInput, null, 2));

        console.log("=== EXISTING ROUTES ===");
        console.log(JSON.stringify(res.data.data.fetchAllInboundRoutes, null, 2));
    } else if (res.data.errors) {
        console.error("GQL ERRORS:", JSON.stringify(res.data.errors, null, 2));
    }
}
run().catch(err => {
    console.error("FAILED:", err.message);
    if (err.response) console.error("BODY:", JSON.stringify(err.response.data));
});
