'use strict';

import * as THREE from './three.module.js';

var turnConfig = {
    // iceServers:[]
    iceServers: [{
    urls: "turn:stun.neurohub.io",
    username: "L1klb44f",
    credential: "zGWe328W"
  }]
};

//Defining some global utility variables
let isChannelReady = false; 
let isInitiator = false;
let isStarted = false;
let pc;
let remoteStream1;
let remoteStream2;
let turnReady;

let container;
let camera, scene, renderer, effect;
let localVideo, remoteVideo, localTexture, remoteTexture, localMaterial, remoteMaterial, localGeometry, remoteGeometry, localMesh, remoteMesh;

let mouseX = 0;
let mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

//Initialize turn/stun server here
const pcConfig = turnConfig;

//Initializing socket.io
const socket = io.connect();

// Prompting for room name:
// const room = 'SgPdEd5PoEen6Y8R';
let room = '';
while (room == '') {
      room = prompt('Enter room name:');
}
room = room.toLowerCase();

console.log('Attempted to create or  join room', room);
socket.emit('create or join', room);

const localStreamConstraints = {
    audio: false, // room[0] === 'a', // if the room starts with an 'a' it streams audio
    // video: { width: 1280, height: 720, facingMode: 'environment' } 
    video: { width: 640, height: 360, facingMode: 'environment' } 
};


//Defining socket connections for signalling
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

//Driver code
socket.on('message', function(message, room) {
    console.log('Client received message:', message,  room);
    if (message === 'got user media') {
      maybeStart();
    } else if (message.type === 'offer') {
      maybeStart();
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
      handleRemoteHangup();
    }
});
  

//Function to send message in a room
function sendMessage(message, room) {
  console.log('Client sending message: ', message, room);
  socket.emit('message', message, room);
}

//Displaying Local Stream and Remote Stream on webpage
remoteVideo1 = document.getElementById( 'remoteVideo1' );
remoteVideo2 = document.getElementById( 'remoteVideo2' );


console.log("Going to find Local media");


console.log('Getting user media with constraints', localStreamConstraints);

//If initiator, create the peer connection
function maybeStart() {
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

//Sending bye if user closes the window
window.onbeforeunload = function() {
  sendMessage('bye', room);
};


//Creating peer connection
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

//Function to handle Ice candidates
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, room);
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

let streamsAdded=0;

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  switch(streamsAdded){
    case 0:
      streamsAdded = 1
      remoteStream1 = event.stream;
      remoteVideo1.srcObject = remoteStream1;
      remoteVideo1.play();
      break;
    case 1:
      streamsAdded = 2
      remoteStream2 = event.stream;
      remoteVideo2.srcObject = remoteStream2;
      remoteVideo2.play();    
      break;
  }
  // animate();
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  remoteVideo.stop();
  sendMessage('bye',room);
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
}

function stop() {
  isInitiator = false;
  isChannelReady = false;
  isStarted = false;
  pc.close();
  pc = null;
}

// ********

// document.body.requestFullscreen();

      init();
      animate();


      function init() {

        container = document.createElement( 'div' );
        document.body.appendChild( container );

        camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
        camera.position.z = 500;

        scene = new THREE.Scene();

        const light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 0.5, 1, 1 ).normalize();
        scene.add( light );

        renderer = new THREE.WebGLRenderer();
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        container.appendChild( renderer.domElement );

        remoteTexture1 = new THREE.VideoTexture( remoteVideo1 );
        const remoteParameters1 = { color: 0xffffff, map: remoteTexture1 };
        remoteMaterial1 = new THREE.MeshLambertMaterial( remoteParameters1 );
        remoteGeometry1 = new THREE.PlaneGeometry( 16, 9 );
        remoteGeometry1.scale( 1.,1.,1. );
        remoteMesh1 = new THREE.Mesh( remoteGeometry1, remoteMaterial1 );

        remoteMesh1.position.x = 0;
        remoteMesh1.position.y = 0;
        remoteMesh1.position.z = 0;

        /// NOTE:  Play with this number -->
        remoteMesh1.scale.x = remoteMesh1.scale.y = remoteMesh1.scale.z = 15.;

        scene.add( remoteMesh1 );

        remoteTexture2 = new THREE.VideoTexture( remoteVideo2 );
        const remoteParameters2 = { color: 0xffffff, map: remoteTexture2 };
        remoteMaterial2 = new THREE.MeshLambertMaterial( remoteParameters2 );
        remoteGeometry2 = new THREE.PlaneGeometry( 16, 9 );
        remoteGeometry2.scale( 1.,1.,1. );
        remoteMesh2 = new THREE.Mesh( remoteGeometry2, remoteMaterial2 );

        remoteMesh2.position.x = 50;
        remoteMesh2.position.y = 0;
        remoteMesh2.position.z = 0;

        /// NOTE:  Play with this number -->
        remoteMesh2.scale.x = remoteMesh2.scale.y = remoteMesh2.scale.z = 15.;

        scene.add( remoteMesh2 );

      

        renderer.autoClear = false;

        window.addEventListener( 'resize', onWindowResize );

      }


      function onWindowResize() {

        windowHalfX = window.innerWidth / 2;
        windowHalfY = window.innerHeight / 2;

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        effect.setSize( window.innerWidth, window.innerHeight );

      }

      function animate() {

        requestAnimationFrame( animate );

        render();

      }


      function render() {

        camera.position.x += ( mouseX - camera.position.x ) * 0.05;
        camera.position.y += ( - mouseY - camera.position.y ) * 0.05;

        camera.lookAt( scene.position );

        renderer.clear();

        effect.render( scene, camera );

      }
