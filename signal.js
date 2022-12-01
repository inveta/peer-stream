"5.0.4";

const { Server } = require("ws");

global.ENGINE = new Server(
	{ noServer: true, clientTracking: true },
	() => { }
);
const iceServers = [{
	urls: [
		"stun:stun.l.google.com:19302",
		"stun:stun1.l.google.com:19302",
		"stun:stun2.l.google.com:19302",
		"stun:stun3.l.google.com:19302",
		"stun:stun4.l.google.com:19302",
	],
},]

ENGINE.on("connection", (ue, req) => {
	ue.req = req;

	ue.fe = new Set()
	// sent to UE5 as initial signal
	ue.send(
		JSON.stringify({
			type: "config",
			peerConnectionOptions: {
				// iceServers
			},
		})
	);

	// 认领空闲的前端们
	for (const fe of PLAYER.clients) {
		if (!fe.ue) {
			PLAYER.emit('connection', fe, fe.req)
		}
	}
	print();

	ue.onmessage = (msg) => {
		msg = JSON.parse(msg.data);


		// Convert incoming playerId to a string if it is an integer, if needed. (We support receiving it as an int or string).

		if (msg.type === "ping") {
			ue.send(JSON.stringify({ type: "pong", time: msg.time }));
			return;
		}

		// player's port as playerID
		const fe = [...ue.fe].find((fe) =>
			fe.req.socket.remotePort === +msg.playerId
		);

		if (!fe) return;

		delete msg.playerId; // no need to send it to the player
		if (["offer", "answer", "iceCandidate"].includes(msg.type)) {
			fe.send(JSON.stringify(msg));
		} else if (msg.type === "disconnectPlayer") {
			fe.close(1011, msg.reason);
		} else { }
	};

	ue.onclose = (e) => {
		ue.fe.forEach(fe => {
			fe.ue = null
		})
		print();
	};

	ue.onerror;

});

// 自启动命令池
const UE5_pool = Object.entries(process.env)
	.filter(([key]) => key.startsWith('UE5_'))
	.map(([, value]) => value)


const HTTP =
	require("http").createServer().listen(+process.env.PORT || 88)

HTTP.on('request', (req, res) => {
	// websocket请求时不触发
	// serve HTTP static files

	const read = require("fs").createReadStream(
		require("path").join(__dirname, req.url)
	);

	read.on("error", (err) => {
		res.end(err.message);
	}).on("ready", () => {
		read.pipe(res);
	});
})

HTTP.on('upgrade', (req, socket, head) => {

	// password
	if (process.env.token) {
		if (req.url !== process.env.token) {
			socket.destroy();
			return;
		}
	}


	// players max count
	if (process.env.limit) {
		if (PLAYER.clients.size >= +process.env.limit) {
			socket.destroy();
			return;
		}
	}

	// throttle
	if (process.env.throttle) {
		if (global.throttle) {
			socket.destroy();
			return;
		} else {
			global.throttle = true;
			setTimeout(() => {
				global.throttle = false;
			}, 500);
		}
	}

	// WS子协议
	if (req.headers['sec-websocket-protocol'] === 'peer-stream') {
		PLAYER.handleUpgrade(req, socket, head, fe => {
			PLAYER.emit('connection', fe, req,)
		})
	} else {
		ENGINE.handleUpgrade(req, socket, head, fe => {
			ENGINE.emit('connection', fe, req,)
		})
	}
})


// front end
global.PLAYER = new Server({
	clientTracking: true,
	noServer: true
});
// every player
PLAYER.on("connection", (fe, req) => {
	fe.req = req;

	if (process.env.one2one) {
		// 选择空闲的ue
		fe.ue = [...ENGINE.clients].find(ue => ue.fe.size === 0)
	} else {
		// 选择人最少的ue
		fe.ue = [...ENGINE.clients].sort((a, b) => a.fe.size - b.fe.size)[0]
	}

	if (fe.ue) {
		fe.ue.fe.add(fe)
		fe.ue.send(
			JSON.stringify({
				type: "playerConnected",
				playerId: req.socket.remotePort,
				dataChannel: true,
				sfu: false,
			})
		);
	} else if (UE5_pool.length) {
		require("child_process").exec(
			UE5_pool[0],
			{ cwd: __dirname, },
			(err, stdout, stderr) => { }
		);
		UE5_pool.push(UE5_pool.shift())
	}

	print();

	fe.onmessage = (msg) => {
		if (!fe.ue) {
			fe.send(`! Engine not ready`);
			return;
		}

		msg = JSON.parse(msg.data);

		msg.playerId = req.socket.remotePort;
		if (["answer", "iceCandidate"].includes(msg.type)) {
			fe.ue.send(JSON.stringify(msg));
		} else {
			fe.send("? " + msg.type);
		}
	};

	fe.onclose = (e) => {
		if (fe.ue) {
			fe.ue.send(JSON.stringify({
				type: "playerDisconnected",
				playerId: req.socket.remotePort
			}));
			fe.ue.fe.delete(fe)
		}

		print();
	};

	fe.onerror;

});

// keep alive
setInterval(() => {
	for (const fe of PLAYER.clients) {
		fe.send("ping");
	}
}, 50 * 1000);

// 打印映射关系
function print() {
	console.clear();
	console.log()

	ENGINE.clients.forEach(ue => {
		console.log(
			ue.req.socket.remoteAddress,
			ue.req.socket.remotePort,
			ue.req.url
		);
		ue.fe.forEach(fe => {
			console.log(
				'     ',
				fe.req.socket.remoteAddress,
				fe.req.socket.remotePort,
				fe.req.url
			);
		})
	})

	const fe = [...PLAYER.clients].filter(fe => !fe.ue)
	if (fe.length) {
		console.log("idle players:");
		fe.forEach(fe => {
			console.log(
				'     ',
				fe.req.socket.remoteAddress,
				fe.req.socket.remotePort,
				fe.req.url
			);
		})
	}
}

// debug
require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
}).on('line', (line) => {
	console.log(eval(line));
});
