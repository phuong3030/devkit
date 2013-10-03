/** @license
 * This file is part of the Game Closure SDK.
 *
 * The Game Closure SDK is free software: you can redistribute it and/or modify
 * it under the terms of the Mozilla Public License v. 2.0 as published by Mozilla.

 * The Game Closure SDK is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * Mozilla Public License v. 2.0 for more details.

 * You should have received a copy of the Mozilla Public License v. 2.0
 * along with the Game Closure SDK.  If not, see <http://mozilla.org/MPL/2.0/>.
 */

from util.browser import $;
import std.uri as URI;
import lib.PubSub;
import util.Animation;
import util.ajax;
import squill.Window;
import squill.Widget;
import squill.Delegate;

import .util.resolutions as Resolutions;
import .util.Inspector as Inspector;
import .util.Simulator as Simulator;
import .util.PortManager as PortManager;

import net;
import net.interfaces;
import net.protocols.Cuppa;

var POSTMESSAGE_PORT = '__debug_timestep_inspector__';

var TopBar = Class(squill.Widget, function(supr) {
	this._def = {
		className: 'topBar',
		children: [
			{id: '_btnSimulatorList', type: 'button', className: 'button', text: 'Choose Simulator'},
			{id: '_simulatorList', className: 'list', children: [
				{className: 'device', id: '_btnAddSimulator', text: 'Add Simulator...'}
			]},
			{id: '_btnDeviceList', type: 'button', className: 'button', text: 'Choose Device'},
			{id: '_deviceList', className: 'list', children: []},
			{id: '_btnReload', type: 'button', className: 'button', text: 'Reload'},
			{id: '_btnInspect', type: 'button', className: 'button', text: 'UI Inspector'},
			{id: '_btnRotate', type: 'button', className: 'button', text: 'Rotate'},
			{id: '_btnScreenShot', type: 'button', className: 'button', text: 'Screenshot'},
			{id: '_btnNativeBack', type: 'button', className: 'button', text: 'Hardware Back'},
			{id: '_btnNativeHome', type: 'button', className: 'button', text: 'Home Screen'},
			{id: '_btnMute', type: 'button', className: 'button', text: 'Mute'},
			{id: '_btnDrag', type: 'button', className: 'button', text: 'Disable Drag'},
			{id: '_btnPause', type: 'button', className: 'button', text: 'Pause'},
			{id: '_btnStep', type: 'button', className: 'button', text: 'Step'},
			{id: '_btnDebug', type: 'button', className: 'button', text: 'Debug'}
		]
	}

	this.init = function (opts) {
		supr(this, 'init', arguments);

		// this.populateSimulatorList();
		// this.populateDeviceList();
		// this._btnMute._el.textContent = (_controller.getActiveSimulator().isMuted() ? 'Unmute':'Mute');
	}

	var deviceList = []; //NOT this._deviceList
	this.populateDeviceList = function () {
		//this doesn't actually need to be public, just done for completeness
		var i;
		for (i in deviceList) {
			deviceList[i].remove();
		}
		deviceList = [];
		i = null;

		for (i in Resolutions.defaults) {
			deviceList.push(new squill.Widget({
				parent: this._deviceList,
				id: i,
				text: Resolutions.defaults[i].name,
				className: 'device'
			}));
		}

		for(i = 0; i < deviceList.length; ++i) {
			deviceList[i].onclick(bind(this, function (evt) {
				_controller.getActiveSimulator().setType(evt.srcElement.id);
				$.hide(this._deviceList);
				this._deviceList.shown = false;
				_controller.updateURI();
			}));
		}
	}

	var simulatorList = [];
	this.populateSimulatorList = function () {
		//clear old list first
		var i;
		for (i in simulatorList) {
			simulatorList[i].remove();
		}
		simulatorList = [];
		i = null;

		var sims = _controller.getAllSimulators();
		for (i in sims) {
			simulatorList.push(new squill.Widget({
				parent: this._simulatorList,
				id: sims[i]._name,
				text: sims[i]._name,
				className: 'device',
				before: this._btnAddSimulator,
				children: [{
						id: '_close_',
						type: 'button',
						attrs: {
							simName: sims[i]._name
						},
						className: 'closeButton',
						text: 'close'
					}
				]
			}));
		}

		for (i in simulatorList) {
			simulatorList[i]._close_.onclick(function (evt) {
				_controller.removeSimulator(_controller.simulatorNameToIndex(this.attributes.getNamedItem('simName').textContent)); //wha
			});
		}

		util.ajax.get({url: '/simulate/remote/attachedDevices', type: 'json'}, bind(this, function (err, devices) {
			var i;
			var devList;
			for (i in devices) {
				simulatorList.push(new squill.Widget({
					parent: this._simulatorList,
					id: i,
					text: devices[i],
					className: 'device',
					before: this._btnAddSimulator
				}));
				simulatorList[simulatorList.length-1].onclick(bind(this, function (evt) {
					_controller._inspector.startRemoteDebugging(evt.srcElement.id);
					$.hide(this._simulatorList);
					this._simulatorList.shown = false;
				}));
			}
		}));

		for (i = 0; i < simulatorList.length; ++i) {
			simulatorList[i].onclick(bind(this, function (evt) {
				_controller.setActiveSimulator(_controller.simulatorNameToIndex(evt.srcElement.id));
				$.hide(this._simulatorList);
				this._simulatorList.shown = false;
			}));
		}

		this._btnAddSimulator.onclick = bind(this, function () {
			_controller.addSimulator({
				device: 'iphone',
				name: "Simulator_" + _controller._simulators.length
			});
			_controller.setActiveSimulator(_controller._simulators.length - 1);
			this.populateSimulatorList(); //refresh the list
			$.hide(this._simulatorList);
			this._simulatorList.shown = false;
			_controller.updateURI();
		});
	}

	var sendToActiveSimulator = function (name, args) {
		_controller.getActiveSimulator().sendEvent(name, args || {});
	}

	var sendToAllSimulators = function (name, args) {
		var i, sims = _controller.getAllSimulators();
		for (i in sims) {
			sims[i].sendEvent(name, args || {});
		};
	}

	this.reloadActiveSimulator = function () {
		sendToActiveSimulator('RELOAD');
	}

	this.delegate = new squill.Delegate(function(on) {
		on._btnSimulatorList = function () {
			this.populateSimulatorList();
			this._simulatorListShown ? $.hide(this._simulatorList) : $.show(this._simulatorList);
			this._simulatorListShown ^= true;
		};

		on._btnDeviceList = function () {
			this.populateDeviceList();
			this._deviceList.shown ? $.hide(this._deviceList) : $.show(this._deviceList);
			this._deviceList.shown ^= true;
		};

		on._btnReload = function() {
			sendToActiveSimulator('RELOAD');
		};

		on._btnInspect = function () {
			_controller._inspector.toggle()
		};

		on._btnRotate = function () {
			sendToActiveSimulator('ROTATE');
			_controller.updateURI();
		};

		on._btnScreenShot = function () {
			sendToActiveSimulator('SCREENSHOT');
		};

		on._btnNativeBack = function () {
			sendToActiveSimulator('BACK_BUTTON');
		};

		on._btnNativeHome = function () {
			sendToActiveSimulator('HOME_BUTTON');
			this._btnNativeHome._el.textContent = (this._btnNativeHome._el.textContent === 'Home Screen'? 'Resume':'Home Screen')
		};

		on._btnMute = function () {
			sendToActiveSimulator('MUTE', this._btnMute._el.textContent === 'Mute');
			this._btnMute._el.textContent = (this._btnMute._el.textContent === 'Mute'? 'Unmute':'Mute');
		};

		on._btnDrag = function () {
			sendToAllSimulators('DRAG', this._btnDrag._el.textContent === 'Enable Drag');
			this._btnDrag._el.textContent = (this._btnDrag._el.textContent === 'Enable Drag'? 'Disable Drag':'Enable Drag');
		};

		on._btnPause = function () {
			sendToActiveSimulator('PAUSE', this._btnPause._el.textContent === 'Pause');
			this._btnPause._el.textContent = (this._btnPause._el.textContent === 'Pause'? 'Unpause':'Pause');
		};

		on._btnStep = function () {
			sendToActiveSimulator('STEP');
			this._btnPause._el.textContent = 'Unpause';
		};

		on._btnDebug = function () {
			sendToActiveSimulator('DEBUG');
			this._btnDebug._el.textContent = (this._btnDebug._el.textContent === 'Debug' ? 'Release' : 'Debug');
		}
	});
});

/**
 * Visual simulator.
 */

var SimulatorServer = Class([net.interfaces.Server, lib.PubSub], function () {
	this.listen = function () {
		net.listen(this, 'postmessage', {port: POSTMESSAGE_PORT});
	}

	this.buildProtocol = function () {
		var conn = new net.protocols.Cuppa();
		conn.onEvent.once('HANDSHAKE', bind(this, 'emit', 'HANDSHAKE', conn));
		return conn;
	}
});

var MainController = exports = Class(squill.Widget, function(supr) {

	this._def = {
		children: [
			{id: '_top', type: TopBar},
			{id: '_middle', children: [{id: '_content'}]},
			{id: '_bottom'}
		]
	};

	this.init = function(opts) {
		supr(this, 'init', arguments);

		this._server = new SimulatorServer();
		this._server.listen();
		this._server.on('HANDSHAKE', bind(this, '_onHandshake'));

		var basePort = parseInt(window.location.port || "80");
		this._portManager = new PortManager({
			start: basePort + 1,
			end: basePort + 20
		});

		this._simulators = {};

		this._manifest = opts.manifest;
		this._appID = opts.manifest.appID;
		this._shortName = opts.manifest.shortName;

		new squill.Window().subscribe('ViewportChange', this, 'onViewportChange');
		this.onViewportChange(null, $(window));

		var inspector = this._inspector = new Inspector({
		 	id: 'inspector',
		 	parent: this,
		 	appID: this._shortName || this._appID
		});

		// add simulators
		this.addSimulator(opts.simulators);

		util.ajax.get({url: '/simulate/addons/', type: 'json'}, bind(this, function (err, res) {
			res.forEach(function (name) {
				jsio.__jsio("import ..addons." + name + ".index").init(this);
			}, this);
		}));
	};

	this._onHandshake = function (conn, evt) {
		if (evt.args.type == 'simulator') {
			var port = evt.args.port;
			var simulator = this._simulators[port];
			if (simulator) {
				simulator.setConn(conn);
			}
		} else {
			// remote device
		}
	}

	this.reloadActiveSimulator = function () {
		this._top.reloadActiveSimulator();
	}

	this.getContainer = function () { return this._content || this._el; }

	this.getManifest = function () { return this._manifest; }

	this.onViewportChange = function (e, dim) { };

	this.getAvailableRect = function () {

		var rect = {
			x: 0,
			y: 0,
			width: this._content.offsetWidth,
			height: document.body.offsetHeight
		};

		if (this._top) {
			var el = this._top.getElement();
			rect.y += el.offsetHeight;
			rect.height -= el.offsetHeight;
		}

		if (this._inspector && this._inspector.isOpen()) {
			var offset = Math.max(0, this._inspector.getElement().offsetWidth);
			rect.x += offset;
			rect.width -= offset;
		}

		return rect;
	};

	this.addLeftPane = function (def) {
		var widget = this.addWidget(def, this._middle);
		var el = widget.getElement ? widget.getElement() : widget;
		el.style.order = -100;

		this.positionSimulators();
		return widget;
	}

	this.addRightPane = function (def) {
		var widget = this.addWidget(def, this._middle);
		var el = widget.getElement ? widget.getElement() : widget;
		el.style.order = 100;

		this.positionSimulators();
		return widget;
	}

	this.positionSimulators = function () {
		Object.keys(this._simulators).forEach(function (port) {
			this._simulators[port].onViewportChange();
		}, this);
	}

	// simulatorDef defines the parameters for a new simulator
	// can also pass an array of defs to create multiple simulators
	//
	// this.addSimulators([{device: string, name: string}, {device: string, name: string}]);
	this.addSimulator = function (simulatorDef) {
		if (isArray(simulatorDef)) {
			return simulatorDef.map(this.addSimulator, this);
		}

		var port = this._portManager.useEmptyPort();
		var simulator = new Simulator({
			controller: this,
			parent: this,
			appName: this._manifest.shortName || this._manifest.appID,
			port: port,
			rotation: parseInt(simulatorDef.rotation, 10),
			deviceName: simulatorDef.device,
			offsetX: simulatorDef.offsetX,
			offsetY: simulatorDef.offsetY,
			name: simulatorDef.name
		});

		this._simulators[port] = simulator;

		if (!this._activeSimulator) {
			this.setActiveSimulator(simulator);
		}

		return port;
	};

	this.removeSimulator = function (port) {
		var simulator = this._simulators[port];
		if (simulator) {
			this._portManager.clearPort(port);
			simulator.remove();

			this._top.populateSimulatorList();
			this.updateURI();
		}
	};

	this.getActiveSimulator = function () { return this._activeSimulator; };
	this.getAllSimulators = function () { return this._simulators; };
	this.getTopBar = function () { return this._top; }

	this.setActiveSimulator = function (simulator) {
		if (this._activeSimulator != simulator) {
			if (this._activeSimulator) {
				this._activeSimulator.setActive(false);
			}

			this._activeSimulator = simulator;
			simulator.setActive(true);

			this._inspector.setSimulator(simulator);
		}
	};

	this.createClients = function (clients, inviteURL) {
		if (inviteURL) {
			var inviteCode = new URI(inviteURL).query('i');
		}

		var numClients = clients.length;
		for (var i = 0; i < numClients; ++i) {
			var params = merge({inviteCode: inviteCode}, clients[i]);
			this.addSimulator([{
				def: params, //TODO this is broken
				name: numClients == 1 ? null : clients[i].displayName
			}]);
		}
	};

	this.updateURI = function () {
		var simulators = [];

		for (var i in this._simulators) {
			simulators.push({
				name: this._simulators[i]._name,
				device: this._simulators[i]._deviceName,
				rotation: this._simulators[i]._rotation
			});
		}

		//TODO: this simulators= thing is a little off, probably need to use the js.io URI class.
		window.location.hash = "simulators="+JSON.stringify(simulators);
	};
});

var _controller;

/**
 * Launch simulator.
 */
exports.start = function () {
	import ff;
	import util.ajax;
	import squill.cssLoad;

	var appID = window.location.toString().match(/\/simulate\/(.*?)\//)[1];

	var f = new ff(function () {
		squill.cssLoad.get('/simulator.css', f.wait());
		util.ajax.get({url: '/projects/' + appID + '/files/manifest.json', type: 'json'}, f.slot());
	}, function (manifest) {
		document.title = manifest.title;

		var uri = new URI(window.location);
		var simulators = JSON.parse(uri.hash('simulators') || '[]');
		if (!simulators.length) {
			simulators[0] = {
				device: 'iphone'
			};
		}

		for (var i in simulators) {
			if (!simulators[i].name) {
				simulators[i].name = "Simulator_" + i;
			}
		}

		_controller = new MainController({
			id: 'mainUI',
			parent: document.body,
			manifest: manifest,
			simulators: simulators
		});
	}).error(function (err) {
		alert(err);
	});
};

$.onEvent(document.body, 'dragenter', this, function (evt) { evt.preventDefault(); });
$.onEvent(document.body, 'dragover', this, function (evt) { evt.preventDefault(); });
$.onEvent(document.body, 'dragleave', this, function (evt) { evt.preventDefault(); });
$.onEvent(document.body, 'drop', this, function (evt) { evt.preventDefault(); });
