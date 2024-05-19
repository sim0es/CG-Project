import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import * as Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

//////////////////////
/* GLOBAL VARIABLES */
//////////////////////

// Global variables for HUD elements
let hudContainer;
let keyStatusElements = {};

let controls;

// default start values for position vars
let axisDim = 1;

let cameras, scene, renderer, activeCamera;

let geometry, material, mesh;

let hasWireframe;
let wireframed_materials = []

let visibleBounds = false;

let FREE_STATE;
let ANIMATION_PHASE;

// Graus de liberdade
let tetha1, tetha2, delta1, delta2;

//colisões
let cargoGrabbed = null;

// constantes
const NUM_CARGOS = 10;

const SCENE_MAX_LENGTH = 250*axisDim;
const FLOOR_HEIGHT = 60*axisDim;

const CLAW_SPEED = 5;
const BOOM_SPEED = 5;
const TROLLEY_SPEED = 100;
const WIRE_SPEED = 100;

const TOWER_HEIGHT = 140 * axisDim;
const BOOM_LENGTH = 160 * axisDim;
const TROLLEY_DIAMETER = 6 * axisDim;
const BASE_HEIGHT = 20*axisDim;
const CONTAINER_SIDE = 25*axisDim;

const CONTAINER_LENGTH = 15*axisDim;
const CONTAINER_HEIGHT = 25*axisDim;

// valores default
const WIRE_MIN_LENGTH = 10 * axisDim;
const WIRE_MAX_LENGTH = 140 * axisDim;
const TROLLEY_X_LIM_I = -0.1*BOOM_LENGTH/2;
const TROLLEY_X_LIM_S = 0.9*BOOM_LENGTH/2;
const CRAW_TIP_MIN_ROT = Math.PI/3;
const CRAW_TIP_MAX_ROT = 5/6*Math.PI;

// graus de liberdade para posição do container
const DELTA1_CONT = 38.5;
const TETHA1_CONT = 0.1615;

tetha1 = 0;
tetha2 = Math.PI*2/3;
delta1 = 0.9*BOOM_LENGTH/2;
delta2 = WIRE_MIN_LENGTH;

// Clock
let clock = new THREE.Clock();
let delta_t = clock.getDelta();

// variaveis globais uteis
let gBoom;
let gClaw;
let gClawTips = [];
let gTrolley;
let gWire;
let gContainer;
let gBase;
let gPlane1, gPlane2, gPlane3, gPlane4, gPlane5;
let gCargos = [];
let gCargosParent;

let keyState = {
    'R': false,
    'F': false,
    'Q': false,
    'A': false,
    'W': false,
    'S': false,
    'E': false,
    'D': false
};


function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

/////////////////////
/* CREATE SCENE(S) */
/////////////////////
function createScene(){
    'use strict';
    scene = new THREE.Scene();

    scene.background = new THREE.Color(0xBBBBBB);

    createFloor();
    createCrane();
    createContainer();
    createCargos();
}

//////////////////////
/* CREATE CAMERA(S) */
//////////////////////

function createCameras() {
    'use strict';

    let camUnit = 300*axisDim;

    // Câmara frontal (front)
    let frontCamera = new THREE.OrthographicCamera(-camUnit, camUnit, camUnit, -camUnit, -camUnit, camUnit);
    frontCamera.position.set(0, 0, camUnit/2);
    frontCamera.lookAt(0, 0, 0);

    // Câmara lateral (side)
    let sideCamera = new THREE.OrthographicCamera(-camUnit, camUnit, camUnit, -camUnit, -camUnit, camUnit);
    sideCamera.position.set(camUnit/2, 0, 0);
    sideCamera.lookAt(0, 0, 0);

    // Câmara de topo (top)
    let topCamera = new THREE.OrthographicCamera(-camUnit, camUnit, camUnit, -camUnit, -camUnit, 2*camUnit);
    topCamera.position.set(0, camUnit, 0);
    topCamera.lookAt(0, 0, 0);

    // Câmara ortográfica
    let orthoCamera = new THREE.OrthographicCamera(-camUnit, camUnit, camUnit, -camUnit, -camUnit, camUnit);
    orthoCamera.position.set(camUnit/4, camUnit/10, camUnit/3); // Posição fora dos eixos principais
    orthoCamera.lookAt(0, 0, 0);

    // Câmara perspectiva
    let perspectiveCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10*camUnit);
    perspectiveCamera.position.set(-camUnit, camUnit, camUnit); // Posição fora dos eixos principais
    perspectiveCamera.lookAt(0, 0, 0);

    // Câmara móvel
    let mobileCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10*camUnit);
    mobileCamera.lookAt(0, -WIRE_MAX_LENGTH, 0);

    // Câmara de inspeção
    let inspectCamera = new THREE.OrthographicCamera(-camUnit, camUnit, camUnit, -camUnit, -camUnit, 10*camUnit);
    inspectCamera.position.set(0, 0, camUnit/2);
    inspectCamera.lookAt(0, 0, 0);
    controls = new OrbitControls(inspectCamera, renderer.domElement);
    controls.enableDamping = true;

    // Adiciona as câmeras à cena
    scene.add(frontCamera);
    scene.add(sideCamera);
    scene.add(topCamera);
    scene.add(orthoCamera);
    scene.add(perspectiveCamera);
    gClaw.claw.add(mobileCamera);
    scene.add(inspectCamera);

    cameras = {
        front: frontCamera,
        side: sideCamera,
        top: topCamera,
        ortho: orthoCamera,
        perspective: perspectiveCamera,
        mobile: mobileCamera,
        inspect: inspectCamera
    };

    //set the default camera
    activeCamera = cameras.inspect;
}

/////////////////////
/* CREATE LIGHT(S) */
/////////////////////

////////////////////////
/* CREATE OBJECT3D(S) */
////////////////////////
function createCrane() {
    let crane = new THREE.Object3D();

    //medidas (X - length ; Y - Height ; Z - Width)

    let baseX = BASE_HEIGHT; 
    let baseY = baseX;
    let baseZ = baseX;

    let towerX = baseX/2;
    let towerY = TOWER_HEIGHT;
    let towerZ = towerX;    

    let boomX = BOOM_LENGTH;
    let boomY = towerX;
    let boomZ = boomY;

    let boomHolderX = boomZ;
    let boomHolderY = 7.5*axisDim;
    let boomHolderZ = boomHolderX;

    let counterWeightX = 20*axisDim;
    let counterWeightY = counterWeightX;
    let counterWeightZ = boomZ*2/3;

    let cabinX = 10*axisDim;
    let cabinY = 20*axisDim;
    let cabinZ = 5*axisDim;

    let trolleyX = TROLLEY_DIAMETER;
    let trolleyY = trolleyX;
    let trolleyZ = trolleyX;

    let riserX = 0.5*axisDim;
    let riserY = 60*axisDim;
    let riserZ = riserX;

    let wireX = 1*axisDim;
    let wireY = delta2;
    let wireZ = wireX;

    let clawBaseX = 5*axisDim;
    let clawBaseY = 1*axisDim;
    let clawBaseZ = clawBaseX;

    let clawCylinderX = 1*axisDim;
    let clawCylinderY = 10*axisDim;
    let clawCylinderZ = clawCylinderX;

    let clawTipX = 2*axisDim;
    let clawTipY = 13*axisDim;
    let clawTipZ = clawTipX;

    // Define material
    let material = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: hasWireframe });
    wireframed_materials.push(material);


    // Base da grua (caixa)
    let baseGeometry = new THREE.BoxGeometry(baseX, baseY, baseZ);
    let base = new THREE.Mesh(baseGeometry, material);
    base.position.set(0, -baseY/2-towerY/2, 0);
    crane.add(base);

    let boundVolBaseGeometry = new THREE.SphereGeometry(computeRadiusForBoundVolOfBox(baseX, baseX, baseX), 32, 32);
    let boundVolBaseMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, visible: visibleBounds });
    let boundVolBase = new THREE.Mesh(boundVolBaseGeometry, boundVolBaseMaterial);
    base.add(boundVolBase);

    gBase = {base: base, boundVol: boundVolBase};

    // Torre metálica
    let towerGeometry = new THREE.BoxGeometry(towerX, towerY, towerZ);
    let tower = new THREE.Mesh(towerGeometry, material);
    tower.position.set(0, 0, 0);
    crane.add(tower);

    let boomRotationObject = new THREE.Object3D();
    boomRotationObject.position.set(0, 0, 0);
    boomRotationObject.rotation.y = tetha1;
    tower.add(boomRotationObject);
    gBoom = boomRotationObject;

    // Lança (caixa)
    let boomGeometry = new THREE.BoxGeometry(boomX, boomY, boomZ);
    let boom = new THREE.Mesh(boomGeometry, material);
    boom.position.set(boomX/5, towerY/2+boomY/2, 0);
    boomRotationObject.add(boom);

    // Porta-lanças (pirâmide quadrangular)
    let boomHolderGeometry = new THREE.ConeGeometry(boomHolderY, boomHolderX, 4);
    let boomHolder = new THREE.Mesh(boomHolderGeometry, material);
    boomHolder.position.set(-boomX/5, boomY, 0);
    boomHolder.rotation.y = Math.PI/4;
    boom.add(boomHolder);

    // Contra-peso (caixa)
    let counterWeightGeometry = new THREE.BoxGeometry(counterWeightX, counterWeightY, counterWeightZ);
    let counterWeight = new THREE.Mesh(counterWeightGeometry, material);
    counterWeight.position.set(-11/30*boomX, -2/3*boomY, 0);
    boom.add(counterWeight);

    // Cabine (caixa)
    let cabinGeometry = new THREE.BoxGeometry(cabinX, cabinY, cabinZ);
    let cabin = new THREE.Mesh(cabinGeometry, material);
    cabin.position.set(-boomX/5, -boomY/2, boomZ/2 + cabinZ/2);
    boom.add(cabin);

    // Carrinho de translação (caixa)
    let trolleyGeometry = new THREE.SphereGeometry(trolleyX/2);
    let trolley = new THREE.Mesh(trolleyGeometry, material);
    trolley.position.set(delta1, -boomY/2, 0);
    boom.add(trolley);
    gTrolley = trolley;

    // Tirantes (cilindro)
    let sp = boomHolder.position.clone();
    sp.y += boomHolderY/1.5;
    
    // tirantes traseiros
    let ep1 = new THREE.Vector3(counterWeight.position.x, boomY/2, boomZ/2); 
    let ep2 = new THREE.Vector3(counterWeight.position.x, boomY/2, -boomZ/2);

    let riserBack1 = addCylinderBetweenPoints(sp, ep1, riserX/2, material);
    let riserBack2 = addCylinderBetweenPoints(sp, ep2, riserX/2, material);

    // tirante frontal
    let ep3 = new THREE.Vector3(boomX/4, boomY/2, 0);

    let riserFront = addCylinderBetweenPoints(sp, ep3, riserX/2, material);
    
    boom.add(riserBack1);
    boom.add(riserBack2);
    boom.add(riserFront);

    // Cabo de aço (cilindro)
    let wireGeometry = new THREE.CylinderGeometry(wireX/2, wireX/2, wireY, 64);
    let wire = new THREE.Mesh(wireGeometry, material);
    wire.scale.y = delta2/getCylinderHeight(wire);
    wire.position.set(0, -delta2/2, 0);
    trolley.add(wire);
    gWire = wire;

    // Garra (caixa + 4 cilindros + 4 pirâmides quadrangulares)
    let claw = new THREE.Object3D();

    // Caixa base da garra
    let clawBaseGeometry = new THREE.BoxGeometry(clawBaseX, clawBaseY, clawBaseZ);
    let clawBase = new THREE.Mesh(clawBaseGeometry, material);
    clawBase.position.set(0, 0, 0); // Posição relativa à garra
    claw.add(clawBase);

    // Cilindros e pontas da garra
    const numCylinders = 4;
    const cylinderRadius = clawCylinderX / 2;
    const cylinderHeight = clawCylinderY;
    const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64);
    
    // Pirâmides quadrangulares (pontas da garra)
    const clawTipGeometry = new THREE.ConeGeometry(clawTipX / 2, clawTipY, 4);

    clawTipGeometry.translate(0, clawTipY / 2, 0);

    for (let i = 0; i < numCylinders; i++) {
        // Criação e posicionamento dos cilindros
        let cylinder = new THREE.Mesh(cylinderGeometry, material);
        claw.add(cylinder);
    
        let angle = (i / numCylinders) * Math.PI * 2 + Math.PI / 4;
        let distanceToCenter = 2*clawBaseX / 2 / Math.cos(Math.PI / 4); // Distância do canto da base ao centro
        let x = Math.cos(angle) * distanceToCenter;
        let z = Math.sin(angle) * distanceToCenter;
        cylinder.position.set(x, -clawCylinderY/4, z);
    
        // Rotação inicial dos cilindros para apontar para o centro da garra
        cylinder.lookAt(0, -1.4 * clawCylinderY, 0);

    
        // Criação e posicionamento das pirâmides nas pontas dos cilindros
        let clawTip = new THREE.Mesh(clawTipGeometry, material);

        cylinder.add(clawTip);

        // rotation between Math.PI*2/3 and Math.PI/2
        clawTip.rotation.x = tetha2;

        clawTip.position.set(0, -clawCylinderY/2, 0); // Posicionamento relativo ao cilindro
        
        gClawTips.push(clawTip);
    }

    let clawBoundVolGeometry = new THREE.SphereGeometry(clawTipY/1.5, 32, 32);
    let clawBoundVolMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, visible: visibleBounds });
    let clawBoundVol = new THREE.Mesh(clawBoundVolGeometry, clawBoundVolMaterial);
    claw.add(clawBoundVol);
    clawBoundVol.position.set(0, -clawCylinderY/3, 0);

    claw.position.set(0, -wireY, 0); // Posição relativa ao cabo de aço
    trolley.add(claw);

    gClaw = {claw: claw, boundVol: clawBoundVol};

    scene.add(crane);

    return crane;
}

function createFloor() {
    let floorMaterial = new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: hasWireframe});
    wireframed_materials.push(floorMaterial);

    let floorGeometry = new THREE.BoxGeometry(SCENE_MAX_LENGTH, FLOOR_HEIGHT, SCENE_MAX_LENGTH);

    let floor = new THREE.Mesh(floorGeometry, floorMaterial);

    scene.add(floor);

    floor.position.set(0, - TOWER_HEIGHT/2 - BASE_HEIGHT - FLOOR_HEIGHT/2 , 0);
    return floor;
}

function addCylinderBetweenPoints(sp, ep, radius, material) {
    let mid = new THREE.Vector3().copy(sp).add(ep).multiplyScalar(0.5);

    let len = sp.distanceTo(ep);

    let geometry = new THREE.CylinderGeometry(radius, radius, len, 64);

    let cylinder = new THREE.Mesh(geometry, material);

    cylinder.position.copy(mid);

    let dir = new THREE.Vector3().copy(ep).sub(sp).normalize();

    let quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    cylinder.setRotationFromQuaternion(quat);

    return cylinder;
}

////////////
/* UPDATE */
////////////
function update(){
    'use strict';
    treatContainerColisions();
    grabbingAnimation();
    treatClawColisions();
    updateHUD();
    controls.update(); // Update controls in each frame
}

/////////////
/* DISPLAY */
/////////////
function render() {
    'use strict';
    renderer.render(scene, activeCamera);
}

////////////////////////////////
/* INITIALIZE ANIMATION CYCLE */
////////////////////////////////
function init() {
    'use strict';
    
    hasWireframe = true;
    FREE_STATE = true;

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    createScene();
    createCameras();
    createHUD();
    

    
    
    render();
    
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);

    
}

/////////////////////
/* ANIMATION CYCLE */
/////////////////////
function animate() {
    'use strict';
    update();
    render();

    delta_t = clock.getDelta();
    
    requestAnimationFrame(animate);
}

////////////////////////////
/* RESIZE WINDOW CALLBACK */
////////////////////////////
function onResize() { 
    'use strict';

    renderer.setSize(window.innerWidth, window.innerHeight);

    if (window.innerHeight > 0 && window.innerWidth > 0) {
        for (let camera of Object.values(cameras)) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
    }
}

function computeRadiusForBoundVolOfBox(x, y, z) {
    return Math.sqrt(x*x + y*y + z*z) / 2;
}

function createContainer() {
    let PLANE_LENGHT = 25*axisDim;

    let material = new THREE.MeshBasicMaterial( {color:0x9977DB, side: THREE.DoubleSide, wireframe: hasWireframe} );
    let material2 = new THREE.MeshBasicMaterial( {color:0x99444B, side: THREE.DoubleSide, wireframe: hasWireframe} );

    wireframed_materials.push(material);
    wireframed_materials.push(material2);

    let geometry = new THREE.BoxGeometry(PLANE_LENGHT, PLANE_LENGHT);

    let container = new THREE.Object3D();

    let boundVolPlaneGeometry = new THREE.SphereGeometry(computeRadiusForBoundVolOfBox(PLANE_LENGHT, PLANE_LENGHT, 0), 32, 32);
    let boundVolPlaneMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, visible: visibleBounds });

    // Plane 1
    let plane1 = new THREE.Mesh( geometry, material);
    plane1.position.set(70*axisDim, -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2, -45*axisDim / 2);
    container.add(plane1);
    let boundVolPlane1 = new THREE.Mesh(boundVolPlaneGeometry, boundVolPlaneMaterial);
    plane1.add(boundVolPlane1);
    gPlane1 = {plane: plane1, boundVol: boundVolPlane1};

    // Plane 2
    let plane2 = new THREE.Mesh( geometry, material);
    plane2.position.set(70*axisDim, -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2, 5*axisDim / 2)
    container.add(plane2);
    let boundVolPlane2 = new THREE.Mesh(boundVolPlaneGeometry, boundVolPlaneMaterial);
    plane2.add(boundVolPlane2);
    gPlane2 = {plane: plane2, boundVol: boundVolPlane2};

    // Plane 3
    let plane3 = new THREE.Mesh( geometry, material);
    plane3.position.set(82.5*axisDim, -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2, -9.5*axisDim )
    plane3.rotation.y = Math.PI /2;
    container.add(plane3);
    let boundVolPlane3 = new THREE.Mesh(boundVolPlaneGeometry, boundVolPlaneMaterial);
    plane3.add(boundVolPlane3);
    gPlane3 = {plane: plane3, boundVol: boundVolPlane3};

    // Plane 4
    let plane4 = new THREE.Mesh( geometry, material);
    plane4.position.set(57.5*axisDim, -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2, -9.75*axisDim )
    plane4.rotation.y = Math.PI / -2;
    container.add(plane4);
    let boundVolPlane4 = new THREE.Mesh(boundVolPlaneGeometry, boundVolPlaneMaterial);
    plane4.add(boundVolPlane4);
    gPlane4 = {plane: plane4, boundVol: boundVolPlane4};

    // Plane 5
    let plane5 = new THREE.Mesh( geometry, material2);
    plane5.position.set(70*axisDim, -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2 - 12.5*axisDim, -20*axisDim / 2)
    plane5.rotation.x = Math.PI / 2;  
    container.add(plane5);

    let boundVolContainerGeometry = new THREE.SphereGeometry(PLANE_LENGHT/2, 32, 32);
    let boundVolContainerMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, visible: visibleBounds });
    let boundVolContainer = new THREE.Mesh(boundVolContainerGeometry, boundVolContainerMaterial);
    container.add(boundVolContainer);
    boundVolContainer.position.set(70*axisDim, -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2, -20*axisDim / 2);

    scene.add(container);

    gContainer = {container: container, boundVol: boundVolContainer};

    return container;
}

function createCargos() {
    let cargos = new THREE.Object3D();

    for (let i = 0; i < NUM_CARGOS; i++) {
        let [cargo, boundVol] = createRandomCargo();

        cargos.add(cargo);
        gCargosParent = cargos;

        gCargos.push({cargo: cargo, boundVol: boundVol});
    }

    scene.add(cargos);

    gBase.base.remove(gBase.boundVol);
    gPlane1.plane.remove(gPlane1.boundVol);
    gPlane2.plane.remove(gPlane2.boundVol);
    gPlane3.plane.remove(gPlane3.boundVol);
    gPlane4.plane.remove(gPlane4.boundVol);

    return cargos;
}

function computeRadiusForTorusKnot(torusRadius, tubeRadius, knotRadius) {
    // Para simplificar, podemos considerar o raio da esfera envolvente como a soma do raio do torus,
    // o raio do tubo e o raio do nó
    return torusRadius + tubeRadius + knotRadius;
}

function computeRadiusForTorus(torusRadius, tubeRadius) {
    // O raio da esfera envolvente para um torus é aproximadamente a soma do raio do torus e o raio do tubo
    return torusRadius + tubeRadius;
}

function createRandomCargo() {
    // Definir os tipos de geometria disponíveis
    const geometryTypes = ['cubo', 'dodecaedro', 'icosaedro', 'torus', 'torusknot'];
    
    // Escolher aleatoriamente um tipo de geometria
    const cargoType = geometryTypes[Math.floor(Math.random() * geometryTypes.length)];
    
    // Definir as dimensões da carga de acordo com o tipo de geometria
    let cargoSize;
    switch (cargoType) {
        case 'cubo':
            cargoSize = { width: getRandomArbitrary(5,15), 
                            height: getRandomArbitrary(5,15), 
                            depth: getRandomArbitrary(5,15) };
            cargoSize['radius_for_boundVol'] = computeRadiusForBoundVolOfBox(
                cargoSize.width, cargoSize.height, cargoSize.depth);
            break;
        case 'dodecaedro':
            cargoSize = { radius: Math.random() * 2 + 5 };
            cargoSize['radius_for_boundVol'] = cargoSize.radius;
            break;
        case 'icosaedro':
            cargoSize = { radius: Math.random() * 2 + 5 };
            cargoSize['radius_for_boundVol'] = cargoSize.radius;
            break;
        case 'torus':
            cargoSize = { radius: getRandomArbitrary(5, 8), 
                            tube: getRandomArbitrary(2, 4), 
                            tubularSegments: 13, 
                            radialSegments: 50,
                            arc: getRandomArbitrary(2, 6.28)};
            cargoSize['radius_for_boundVol'] = computeRadiusForTorus(cargoSize.radius, cargoSize.tube);
            break; 
        case 'torusknot':
            cargoSize = {   radius: getRandomArbitrary(3, 6), 
                            tube: getRandomArbitrary(2, 4),
                            tubularSegments: 64, 
                            radialSegments: 12,
                            p: getRandomArbitrary(2, 6),
                            q: getRandomArbitrary(2, 5)};
            cargoSize['radius_for_boundVol'] = computeRadiusForTorusKnot(cargoSize.radius, cargoSize.tube, cargoSize.tube);
            break;
    }
    
    // Criar a geometria da carga com base nas dimensões definidas
    let cargoGeometry;
    switch (cargoType) {
        case 'cubo':
            cargoGeometry = new THREE.BoxGeometry(cargoSize.width, cargoSize.height, cargoSize.depth);
            break;
        case 'dodecaedro':
            cargoGeometry = new THREE.DodecahedronGeometry(cargoSize.radius);
            break;
        case 'icosaedro':
            cargoGeometry = new THREE.IcosahedronGeometry(cargoSize.radius);
            break;
        case 'torus':
            cargoGeometry = new THREE.TorusGeometry(cargoSize.radius, 
                                                    cargoSize.tube, 
                                                    cargoSize.tubularSegments, 
                                                    cargoSize.radialSegments,
                                                    cargoSize.arc);
            break;
        case 'torusknot':    
            cargoGeometry = new THREE.TorusKnotGeometry(cargoSize.radius, 
                                                        cargoSize.tube, 
                                                        cargoSize.tubularSegments, 
                                                        cargoSize.radialSegments, 
                                                        cargoSize.p, 
                                                        cargoSize.q);
            break;
    }
    
    // Criar a carga com a geometria definida
    const cargoMaterial = new THREE.MeshBasicMaterial({ color: 0x9d5252, wireframe: hasWireframe});
    wireframed_materials.push(cargoMaterial);

    const cargo = new THREE.Mesh(cargoGeometry, cargoMaterial);
    const basePosition = new THREE.Vector3(0, -TOWER_HEIGHT/2 - BASE_HEIGHT/2, 0);

    // Raio do círculo onde a carga será posicionada com margem de erro
    const radius = BOOM_LENGTH*7/10;
    const angle = Math.random() * Math.PI * 2;
    const randomX = basePosition.x + Math.cos(angle) * radius * Math.random();
    const randomZ = basePosition.z + Math.sin(angle) * radius * Math.random();
    cargo.position.set(randomX, -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2 , randomZ);
    
    // Criar a bounding sphere da carga
    const boundVolSize = cargoSize.radius_for_boundVol;
    const boundVolGeometry = new THREE.SphereGeometry(boundVolSize, 32, 32);
    const boundVolMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, visible: visibleBounds });

    const boundVol = new THREE.Mesh(boundVolGeometry, boundVolMaterial);
    cargo.add(boundVol);

    // Verificar se a carga está a colidir com algum objeto
    const intersectingObjects = gCargos.some(c => sphereCollision(boundVol, c.boundVol));

    const intersectingBase = sphereCollision(boundVol, gBase.boundVol);

    const intersectingContainer = sphereCollision(boundVol, gPlane1.boundVol) ||
                                sphereCollision(boundVol, gPlane2.boundVol) ||
                                sphereCollision(boundVol, gPlane3.boundVol) ||
                                sphereCollision(boundVol, gPlane4.boundVol);

    if (!intersectingObjects && !intersectingBase && !intersectingContainer &&
        cargo.position.x < radius  && cargo.position.x > -radius && 
        cargo.position.z < radius && cargo.position.z > -radius && 
        cargo.position.y == -TOWER_HEIGHT/2 - BASE_HEIGHT + CONTAINER_HEIGHT/2) {
        return [cargo, boundVol];
    } else {
        return createRandomCargo(); // Retry with a new random position
    }
}

function sphereCollision(s1, s2) {
    let p1 = positionInWCS(s1);
    let p2 = positionInWCS(s2);

    return dt2(p1, p2) < Math.pow(s1.geometry.parameters.radius + s2.geometry.parameters.radius, 2);
}

function positionInWCS(obj) {
    // Create a vector to hold the world position
    const position = new THREE.Vector3();

    // Obtain the world position of the object
    obj.getWorldPosition(position);

    // Return the world position
    return position;
}

function dt2(p1, p2) {
    return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2);
}

///////////////////////
/* KEY DOWN CALLBACK */
///////////////////////
function onKeyDown(e) {

    updateHUD();

    'use strict';

    switch(e.key) {
        case '1':
            activeCamera = cameras.front;
            break;
        case '2':
            activeCamera = cameras.side;
            break;
        case '3':
            activeCamera = cameras.top;
            break;
        case '4':
            activeCamera = cameras.ortho;
            break;
        case '5':
            activeCamera = cameras.perspective;
            break;
        case '6':
            activeCamera = cameras.mobile;
            break;
        case '7':
            hasWireframe = !hasWireframe;

            for (let mat of wireframed_materials) {
                mat.wireframe = hasWireframe;
            }
            break;
        case '0':
            activeCamera = cameras.inspect;
            break;
        
        default:
            let key = e.key.toUpperCase();

            if (!(key in keyState)) break;

            keyState[key] = true;

            if (FREE_STATE) handleKeyActions(e.key);
            break;
    }
}

function handleKeyActions() {
    if (keyState['R']) updateClawTipRotation('+');
    if (keyState['F']) updateClawTipRotation('-');
    if (keyState['Q']) updateBoomRotation('+');
    if (keyState['A']) updateBoomRotation('-');
    if (keyState['W']) updateTrolleyTranslation('+');
    if (keyState['S']) updateTrolleyTranslation('-');
    if (keyState['E']) updateWireTranslation('-');
    if (keyState['D']) updateWireTranslation('+');
}



function updateClawTipRotation(dir){
    'use strict';

    if (dir === '+') tetha2 += CLAW_SPEED*delta_t;
    if (dir === '-') tetha2 -= CLAW_SPEED*delta_t;

    // Ensure tetha2 remains within the valid range
    if (tetha2 < CRAW_TIP_MIN_ROT) tetha2 = CRAW_TIP_MIN_ROT;
    if (tetha2 > CRAW_TIP_MAX_ROT) tetha2 = CRAW_TIP_MAX_ROT;

    
    // Iterate over the children of claw (cylinders) to update the rotation of clawTip
    gClawTips.forEach(tip => {
        tip.rotation.x = tetha2;
    });
}

function updateBoomRotation(dir){
    'use strict';
    if (dir === '+') tetha1 += BOOM_SPEED*delta_t;
    if (dir === '-') tetha1 -= BOOM_SPEED*delta_t;

    if (tetha1 < 0) tetha1 += 2*Math.PI;
    if (tetha1 > 2*Math.PI) tetha1 -= 2*Math.PI;

    gBoom.rotation.x = tetha1;
}

function updateTrolleyTranslation(dir){
    'use strict';

    if (dir === '+') delta1 += TROLLEY_SPEED*delta_t;
    if (dir === '-') delta1 -= TROLLEY_SPEED*delta_t;

    if (delta1 < TROLLEY_X_LIM_I) delta1 = TROLLEY_X_LIM_I;
    if (delta1 > TROLLEY_X_LIM_S) delta1 = TROLLEY_X_LIM_S;

    gTrolley.position.x = delta1;
}

function updateWireTranslation(dir){
    'use strict';

    if (dir === '+') delta2 += WIRE_SPEED*delta_t;
    if (dir === '-') delta2 -= WIRE_SPEED*delta_t;

    if (delta2 < WIRE_MIN_LENGTH) delta2 = WIRE_MIN_LENGTH;
    if (delta2 > WIRE_MAX_LENGTH) delta2 = WIRE_MAX_LENGTH;

    gWire.scale.y = delta2/getCylinderHeight(gWire);
    gWire.position.y = 0.9-delta2/2;
    gClaw.claw.position.y = -delta2;
}

function getCylinderHeight(mesh) {
    return mesh.geometry.parameters.height;
}

///////////////////////
/* KEY UP CALLBACK */
///////////////////////
function onKeyUp(e){

    updateHUD();

    'use strict';

    let key = e.key.toUpperCase();

    if (!(key in keyState)) return;

    if (key in keyState) keyState[key] = false;

    

    //keyState[key] = false;
    
}

function treatClawColisions(){
    if (FREE_STATE) {
        for (let cargo of gCargos) {
            if (sphereCollision(gClaw.boundVol, cargo.boundVol)) {
                FREE_STATE = false;
                ANIMATION_PHASE = 1;

                cargoGrabbed = cargo;
                gCargosParent.remove(cargo.cargo);
                gCargos.splice(gCargos.indexOf(cargo), 1);
                gClaw.claw.add(cargo.cargo);
                cargo.cargo.position.set(0, gClaw.boundVol.position.y*3, 0);
                break;
            }
        }
    }
}

function grabbingAnimation() {
    if (!FREE_STATE) {
        let tetha1_interval = BOOM_SPEED*delta_t;
        let delta1_interval = TROLLEY_SPEED*delta_t;

        switch (ANIMATION_PHASE) {
            case 1:
                if (delta2 > WIRE_MIN_LENGTH) {
                    delta2 -= WIRE_SPEED*delta_t;
                } else {
                    delta2 = WIRE_MIN_LENGTH;
                    ANIMATION_PHASE = 2;
                }
                break;

            case 2:
                if (Math.abs(TETHA1_CONT - tetha1) < tetha1_interval) {
                    tetha1 = TETHA1_CONT;
                    ANIMATION_PHASE = 3;
                } else {
                    tetha1 += tetha1_interval;
                    if (tetha1 < 0) tetha1 += 2*Math.PI;
                    if (tetha1 > 2*Math.PI) tetha1 -= 2*Math.PI;
                }
                break;

            case 3:
                if (Math.abs(DELTA1_CONT - delta1) < delta1_interval) {
                    delta1 = DELTA1_CONT;
                    ANIMATION_PHASE = 4;
                } else if (DELTA1_CONT < delta1) {
                    delta1 -= delta1_interval;
                } else {
                    delta1 += delta1_interval;
                }   
                break;

            case 4:
                delta2 += WIRE_SPEED*delta_t;
                break;
        }
                

        gBoom.rotation.y = tetha1;
        gTrolley.position.x = delta1;
        gWire.scale.y = delta2/getCylinderHeight(gWire);
        gWire.position.y = 0.9-delta2/2;
        gClaw.claw.position.y = -delta2;
    }
}

function treatContainerColisions(){
    
    if (!FREE_STATE && sphereCollision(gContainer.boundVol, cargoGrabbed.boundVol)) {
        FREE_STATE = true;

        gClaw.claw.remove(cargoGrabbed.cargo);
        cargoGrabbed = null;
    }
}


// Function to create HUD elements
// Function to create HUD elements
function createHUD() {
    hudContainer = document.createElement('div');
    hudContainer.id = 'hud';
    hudContainer.style.position = 'fixed';
    hudContainer.style.top = '20px';
    hudContainer.style.left = '20px';
    hudContainer.style.color = 'white';
    hudContainer.style.fontFamily = 'Arial';
    hudContainer.style.fontSize = '18px';
    document.body.appendChild(hudContainer);

    // Create status elements for each key
    const keys = ['Q', 'A', 'W', 'S', 'E', 'D', 'R', 'F'];
    keys.forEach(key => {
        const keyStatus = document.createElement('div');
        keyStatus.textContent = `${key}: Not Pressed`;
        hudContainer.appendChild(keyStatus);
        keyStatusElements[key] = keyStatus;
    });

    // Create status element for Camera
    const cameraStatus = document.createElement('div');
    cameraStatus.textContent = `Camera: Inspect`;
    hudContainer.appendChild(cameraStatus);
    keyStatusElements['Camera'] = cameraStatus;

    // Add wireframe toggle status
    const wireframeStatus = document.createElement('div');
    wireframeStatus.textContent = `Wireframe: ${hasWireframe ? 'On' : 'Off'}`;
    hudContainer.appendChild(wireframeStatus);
    keyStatusElements['7'] = wireframeStatus;
}

// Function to update HUD based on key state
function updateHUD() {
    Object.entries(keyStatusElements).forEach(([key, element]) => {
        if (key === '7') {
            element.textContent = `Wireframe: ${hasWireframe ? 'On' : 'Off'}`;
        } else {
            const status = keyState[key] ? 'Pressed' : 'Not Pressed';
            element.textContent = `${key}: ${status}`;
        }
    });

    // Update camera status
    keyStatusElements['Camera'].textContent = `Camera: ${getCameraStatus(activeCamera)}`;
}

function getCameraStatus(camera) {
    // Loop through the cameras object to find the active camera
    for (const [key, value] of Object.entries(cameras)) {
        if (value === camera) {
            return key.charAt(0).toUpperCase() + key.slice(1); // Capitalize first letter
        }
    }
    return 'Inspect'; // Default to Inspect if camera not found
}


init();
animate();