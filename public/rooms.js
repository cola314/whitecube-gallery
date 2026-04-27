export const ROOMS = {
  'single-hall': {
    id: 'single-hall',
    name: '단일 홀 (22 × 36 m)',
    dim: { w: 22, d: 36, h: 5 },
    colors: { wall: 0xfafafa, floor: 0xe8e8ec, ceiling: 0xf2f2f4 },
    spawn: { x: 0, y: 1.65, z: 9 },
    slots: [
      { id: 'L-1', label: '좌측 1', x: -10.98, y: 1.7, z: -12, ry:  Math.PI/2 },
      { id: 'L-2', label: '좌측 2', x: -10.98, y: 1.7, z:  -4, ry:  Math.PI/2 },
      { id: 'L-3', label: '좌측 3', x: -10.98, y: 1.7, z:   4, ry:  Math.PI/2 },
      { id: 'L-4', label: '좌측 4', x: -10.98, y: 1.7, z:  12, ry:  Math.PI/2 },
      { id: 'R-1', label: '우측 1', x:  10.98, y: 1.7, z: -12, ry: -Math.PI/2 },
      { id: 'R-2', label: '우측 2', x:  10.98, y: 1.7, z:  -4, ry: -Math.PI/2 },
      { id: 'R-3', label: '우측 3', x:  10.98, y: 1.7, z:   4, ry: -Math.PI/2 },
      { id: 'R-4', label: '우측 4', x:  10.98, y: 1.7, z:  12, ry: -Math.PI/2 },
      { id: 'B-1', label: '뒷벽 1', x:  -4.5,  y: 1.7, z: -17.98, ry: 0 },
      { id: 'B-2', label: '뒷벽 2', x:   4.5,  y: 1.7, z: -17.98, ry: 0 }
    ]
  },
  'corridor': {
    id: 'corridor',
    name: '복도형 갤러리 (8 × 40 m)',
    dim: { w: 8, d: 40, h: 4 },
    colors: { wall: 0xfafafa, floor: 0xe6e6ea, ceiling: 0xf0f0f3 },
    spawn: { x: 0, y: 1.65, z: 17 },
    slots: [
      { id: 'L-1', label: '좌측 1', x: -3.98, y: 1.65, z: -16, ry:  Math.PI/2 },
      { id: 'L-2', label: '좌측 2', x: -3.98, y: 1.65, z:  -8, ry:  Math.PI/2 },
      { id: 'L-3', label: '좌측 3', x: -3.98, y: 1.65, z:   0, ry:  Math.PI/2 },
      { id: 'L-4', label: '좌측 4', x: -3.98, y: 1.65, z:   8, ry:  Math.PI/2 },
      { id: 'R-1', label: '우측 1', x:  3.98, y: 1.65, z: -16, ry: -Math.PI/2 },
      { id: 'R-2', label: '우측 2', x:  3.98, y: 1.65, z:  -8, ry: -Math.PI/2 },
      { id: 'R-3', label: '우측 3', x:  3.98, y: 1.65, z:   0, ry: -Math.PI/2 },
      { id: 'R-4', label: '우측 4', x:  3.98, y: 1.65, z:   8, ry: -Math.PI/2 },
      { id: 'B-1', label: '끝벽 중앙', x:  0,  y: 1.7,  z: -19.98, ry: 0 }
    ]
  },
  'small-room': {
    id: 'small-room',
    name: '소형 룸 (14 × 14 m)',
    dim: { w: 14, d: 14, h: 4 },
    colors: { wall: 0xf8f8f9, floor: 0xeaeaef, ceiling: 0xf2f2f4 },
    spawn: { x: 0, y: 1.65, z: 5 },
    slots: [
      { id: 'L-1', label: '좌측 1', x: -6.98, y: 1.65, z: -3, ry:  Math.PI/2 },
      { id: 'L-2', label: '좌측 2', x: -6.98, y: 1.65, z:  3, ry:  Math.PI/2 },
      { id: 'R-1', label: '우측 1', x:  6.98, y: 1.65, z: -3, ry: -Math.PI/2 },
      { id: 'R-2', label: '우측 2', x:  6.98, y: 1.65, z:  3, ry: -Math.PI/2 },
      { id: 'B-1', label: '뒷벽 좌', x: -3.5, y: 1.7, z: -6.98, ry: 0 },
      { id: 'B-2', label: '뒷벽 우', x:  3.5, y: 1.7, z: -6.98, ry: 0 }
    ]
  }
};

export function listRooms() {
  return Object.values(ROOMS);
}

export function getRoom(id) {
  return ROOMS[id] || ROOMS['single-hall'];
}
