const { WebSocketServer } = require("ws");
const http = require("http");
const { default: axios } = require("axios");

const server = http.createServer();
const wsServer = new WebSocketServer({ server });
const port = 8000;

const clients = new Map();

wsServer.on("connection", function (connection) {
  console.log(`Received a new connection.`);

  const userId = generateUserId();
  clients.set(userId, connection);
  sendId(userId);

  connection.on("message", async function incoming(rawData) {
    const data = JSON.parse(rawData.toString());

    sendMessage(data.toUsername, data.message, data.token);
    sendMessageToUser(
      data.socketId,
      JSON.stringify({
        type: "message",
        dataChat: {
          message: data.message,
          pathFile: null,
          userSender: { username: data.fromUsername },
          userReceiver: { username: data.toUsername },
        },
      })
    );

    const detailReceiver = await getUserProfile(data.token, data.toUsername);
    console.log(detailReceiver);

    if (detailReceiver.user.socketId) {
      sendMessageToUser(
        detailReceiver.user.socketId,
        JSON.stringify({
          type: "message",
          dataChat: {
            message: data.message,
            pathFile: null,
            userSender: { username: data.fromUsername },
            userReceiver: { username: data.toUsername },
          },
        })
      );
    }
  });

  connection.on("close", function () {
    console.log("Connection closed");

    clients.delete(userId);
  });
});

function sendId(userId) {
  const connection = clients.get(userId);
  if (connection) {
    connection.send(
      JSON.stringify({
        type: "sendId",
        userId: userId,
      })
    );
  } else {
    console.log(`User ${userId} not found.`);
  }
}

function sendMessageToUser(userId, data) {
  console.log("Send to ID:" + userId);
  const connection = clients.get(userId);
  console.log(connection);
  if (connection) {
    connection.send(data);
  } else {
    console.log(`User ${userId} not found.`);
  }
}

function generateUserId() {
  return Math.random().toString(36).substring(7);
}

const getUserProfile = async (token, username) => {
  try {
    const response = await axios.get(
      "http://localhost:8080/api/user/detail/username?username=" + username,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 200) {
      console.log(`Login: ${response.data.user.firstName}`);
      return response.data;
    } else {
      console.error(response.data.message);
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};

async function sendMessage(username, message, token) {
  try {
    const formData = new FormData();
    formData.append("usernameReceiver", username);
    formData.append("message", message);
    formData.append("file", new Blob(), "dummy.txt");

    await axios.post("http://localhost:8080/api/chat", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: "Bearer " + token,
      },
    });
  } catch (error) {
    if (error.response && error.response.data && error.response.data.message) {
      console.log("Error:", error.response.data.message);
    } else {
      console.log("Error:", error.message);
    }
  }
}

server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});
