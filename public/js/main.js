'use strict';


      import * as THREE from './three.module.js';

      import { StereoEffect } from './StereoEffect.js';

var turnConfig = {
    iceServers:[]
    // iceServers: [{   urls: [ "stun:bn-turn1.xirsys.com" ]}, {   username: "0kYXFmQL9xojOrUy4VFemlTnNPVFZpp7jfPjpB3AjxahuRe4QWrCs6Ll1vDc7TTjAAAAAGAG2whXZWJUdXRzUGx1cw==",   credential: "285ff060-5a58-11eb-b269-0242ac140004",   urls: [       "turn:bn-turn1.xirsys.com:80?transport=udp",       "turn:bn-turn1.xirsys.com:3478?transport=udp",       "turn:bn-turn1.xirsys.com:80?transport=tcp",       "turn:bn-turn1.xirsys.com:3478?transport=tcp",       "turns:bn-turn1.xirsys.com:443?transport=tcp",       "turns:bn-turn1.xirsys.com:5349?transport=tcp"   ]}]
};

//Defining some global utility variables
let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let localStream;
let pc;
let remoteStream;
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

const localStreamConstraints = {
//     audio: false,
    video: { width: 1280, height: 720, facingMode: 'environment' } 
  };


// Prompting for room name:
// const room = 'SgPdEd5PoEen6Y8R';
const room = prompt('Enter room name:');

//Initializing socket.io
const socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

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
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
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
localVideo = document.getElementById( 'localVideo' );
remoteVideo = document.getElementById( 'remoteVideo' );


console.log("Going to find Local media");


if ( navigator.mediaDevices && navigator.mediaDevices.getUserMedia ) {
  navigator.mediaDevices.getUserMedia( localStreamConstraints )
    .then( gotStream )
    .catch( function ( error ) {
      console.error( 'Unable to access the camera/webcam.', error );
    } );
} else {
  console.error( 'MediaDevices interface not available.' );
}

//If found local stream
function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  localVideo.play();
  sendMessage('got user media', room);
  if (isInitiator) {
    maybeStart();
  }
}


console.log('Getting user media with constraints', localStreamConstraints);

//If initiator, create the peer connection
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
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


function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
  remoteVideo.play();
  // animate();
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye',room);
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

// ********


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

          // video = document.getElementById( 'remoteVideo' );
        remoteTexture = new THREE.VideoTexture( remoteVideo );
        const remoteParameters = { color: 0xffffff, map: remoteTexture };
        remoteMaterial = new THREE.MeshLambertMaterial( remoteParameters );
        remoteGeometry = new THREE.PlaneGeometry( 16, 9 );
        remoteGeometry.scale( 1.,1.,1. );
        remoteMesh = new THREE.Mesh( remoteGeometry, remoteMaterial );

        remoteMesh.position.x = 0;
        remoteMesh.position.y = 0;
        remoteMesh.position.z = 0;

        /// NOTE:  Play with this number -->
        remoteMesh.scale.x = remoteMesh.scale.y = remoteMesh.scale.z = 30.;

        scene.add( remoteMesh );


        localTexture = new THREE.VideoTexture( localVideo );
        const localParameters = { color: 0xffffff, map: localTexture };
        localMaterial = new THREE.MeshLambertMaterial( localParameters );
        localGeometry = new THREE.PlaneGeometry( 16, 9 );
        localGeometry.scale( 1.,1.,1. );
        localMesh = new THREE.Mesh( localGeometry, localMaterial );

        localMesh.position.x = 100;
        localMesh.position.y = 100;
        localMesh.position.z = 0;

        /// NOTE:  Play with this number -->
        localMesh.scale.x = localMesh.scale.y = localMesh.scale.z = 10.;

        scene.add( localMesh );

      

        renderer.autoClear = false;


        effect = new StereoEffect( renderer );
        effect.setSize( window.innerWidth, window.innerHeight );


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
