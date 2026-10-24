import { residents, type Point, type DestinationId } from "./profiles"
export const WIDTH = 480,
  HEIGHT = 320
type C = CanvasRenderingContext2D
function rect(c: C, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}
function ellipse(
  c: C,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  // Scanline ellipses remain strictly on the pixel grid.
  for (let j = -h; j <= h; j++) {
    const dx = Math.floor(w * Math.sqrt(1 - (j * j) / (h * h)))
    rect(c, x - dx, y + j, dx * 2 + 1, 1, color)
  }
}
function tree(c: C, x: number, y: number, s = 1) {
  c.save()
  c.translate(x, y)
  // Integer transforms preserve crisp edges at the logical resolution.
  c.translate(0, Math.round((1 - s) * 12))
  ellipse(c, 1, 6, 15, 5, "#70945c")
  rect(c, -3, -10, 6, 19, "#77573d")
  rect(c, 0, -9, 2, 17, "#9d7850")
  ellipse(c, 0, -20, 16, 16, "#365e43")
  ellipse(c, -5, -26, 12, 13, "#48744c")
  ellipse(c, 4, -29, 11, 12, "#588452")
  ellipse(c, -4, -34, 8, 8, "#6c955e")
  rect(c, -11, -28, 4, 3, "#81a467")
  rect(c, 5, -21, 4, 3, "#6b9259")
  c.restore()
}
function pine(c: C, x: number, y: number) {
  rect(c, x - 2, y - 8, 4, 12, "#79593e")
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 12; j++)
      rect(
        c,
        x - j,
        y - 38 + i * 8 + j,
        j * 2 + 1,
        1,
        i % 2 ? "#426e49" : "#365e43"
      )
  }
}
function fence(c: C, x: number, y: number, n: number) {
  rect(c, x, y + 4, n * 9, 2, "#a3895d")
  rect(c, x, y + 9, n * 9, 2, "#a3895d")
  for (let i = 0; i <= n; i++) {
    rect(c, x + i * 9, y, 3, 15, "#eed9a1")
    rect(c, x + i * 9 + 2, y + 2, 1, 13, "#b69c6b")
  }
}
function flower(c: C, x: number, y: number, color: string) {
  rect(c, x, y, 1, 4, "#577c43")
  rect(c, x - 1, y - 2, 3, 3, color)
  rect(c, x, y - 1, 1, 1, "#f4dfa0")
}
function bench(c: C, x: number, y: number) {
  rect(c, x + 2, y + 7, 2, 7, "#5e5a42")
  rect(c, x + 21, y + 7, 2, 7, "#5e5a42")
  rect(c, x, y, 25, 3, "#a4774b")
  rect(c, x, y + 4, 25, 3, "#bd925e")
  rect(c, x - 1, y + 9, 27, 3, "#cfab74")
}
function lamp(c: C, x: number, y: number) {
  rect(c, x, y - 22, 2, 25, "#606049")
  rect(c, x - 3, y - 25, 8, 7, "#6e6850")
  rect(c, x - 2, y - 24, 6, 5, "#f4df9b")
  rect(c, x - 2, y - 27, 6, 2, "#505943")
  rect(c, x - 2, y + 2, 6, 2, "#606049")
}
function building(
  c: C,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  roof: string,
  kind: number
) {
  rect(c, x + 4, y + 12, w + 3, h + 3, "#789361")
  rect(c, x, y, w, h, "#b58f65")
  rect(c, x + 2, y, w - 4, h - 3, "#f1d9a5")
  for (let j = y + 25; j < y + h - 3; j += 5) {
    rect(c, x + 3, j, w - 6, 1, "#dfc38f")
  }
  rect(c, x - 5, y + 5, w + 10, 25, "#765946")
  for (let j = 0; j < 25; j += 4) {
    rect(c, x - 4, y + 3 + j, w + 8, 3, roof)
    for (let i = 0; i < w + 5; i += 9)
      rect(c, x - 4 + i + (j % 8 ? 4 : 0), y + 3 + j, 1, 3, "#b76c52")
  }
  rect(c, x - 6, y + 28, w + 12, 3, "#895c45")
  rect(c, x + 9, y - 5, 9, 15, "#a27658")
  rect(c, x + 8, y - 6, 11, 3, "#d4b08a")
  const door = x + w / 2 - 6
  rect(c, door, y + h - 24, 13, 24, "#765b43")
  rect(c, door + 2, y + h - 22, 9, 19, "#b38b60")
  rect(c, door + 3, y + h - 20, 7, 9, "#6d9b8d")
  rect(c, door + 10, y + h - 9, 1, 2, "#f9e3a7")
  rect(c, door - 3, y + h, 19, 3, "#d8c29a")
  for (const wx of [x + 9, x + w - 24]) {
    rect(c, wx, y + 39, 15, 16, "#8f7455")
    rect(c, wx + 2, y + 41, 11, 12, "#80a59a")
    rect(c, wx + 3, y + 42, 3, 8, "#b0c8b0")
    rect(c, wx + 7, y + 41, 1, 12, "#ead5a3")
    rect(c, wx, y + 55, 16, 3, "#a37a50")
  }
  rect(c, x + w / 2 - 25, y + 31, 50, 10, kind === 1 ? "#486c5a" : "#fcdfaf")
  c.fillStyle = kind === 1 ? "#f7e7b8" : "#675340"
  c.font = "bold 6px monospace"
  c.textAlign = "center"
  c.fillText(name, x + w / 2, y + 38)
  if (kind === 0) {
    for (let i = 0; i < 8; i++)
      rect(
        c,
        x + 3 + (i * (w - 6)) / 8,
        y + 42,
        (w - 6) / 8,
        6,
        i % 2 ? "#f5e4b9" : "#ca795d"
      )
  }
  if (kind === 2) {
    rect(c, x + 6, y + 59, 14, 18, "#635e71")
    rect(c, x + 8, y + 61, 10, 8, "#c6a5b2")
    rect(c, x + w - 20, y + 59, 14, 18, "#6e7c65")
    rect(c, x + w - 18, y + 61, 10, 8, "#d7bc81")
  }
  for (const px of [x - 3, x + w - 1]) {
    rect(c, px, y + h - 7, 7, 8, "#b07850")
    ellipse(c, px + 3, y + h - 9, 5, 4, "#547b49")
    flower(c, px + 3, y + h - 12, "#ecc68c")
  }
}
export function drawResident(
  c: C,
  index: number,
  x: number,
  y: number,
  walking = false,
  t = 0
) {
  const hair = ["#76472f", "#343f39", "#5c4262"][index],
    shirt = ["#e9a66b", "#719a8b", "#ac94bc"][index]
  ellipse(c, x, y + 2, 6, 2, "#82916a")
  const step = walking ? Math.floor(t * 7) % 2 : 0
  rect(c, x - 3, y - 3, 2, 5 - step, "#514e47")
  rect(c, x + 1, y - 3, 2, 4 + step, "#514e47")
  rect(c, x - 4, y - 10, 8, 8, shirt)
  rect(c, x - 5, y - 9, 2, 6, "#e4b58b")
  rect(c, x + 4, y - 9, 2, 6, "#e4b58b")
  rect(c, x - 4, y - 17, 8, 8, hair)
  rect(c, x - 3, y - 14, 6, 6, "#e9bd94")
  rect(c, x - 2, y - 12, 1, 1, "#4b453b")
  rect(c, x + 2, y - 12, 1, 1, "#4b453b")
  rect(c, x - 3, y - 17, 7, 3, hair)
  if (index === 0) {
    rect(c, x - 5, y - 15, 2, 8, hair)
    rect(c, x + 3, y - 15, 2, 8, hair)
    rect(c, x + 4, y - 15, 2, 2, "#e7b558")
  }
  if (index === 1) {
    rect(c, x - 5, y - 18, 10, 3, "#5a7968")
    rect(c, x - 6, y - 15, 11, 2, "#5a7968")
  }
  if (index === 2) {
    rect(c, x - 5, y - 16, 2, 11, hair)
    rect(c, x + 3, y - 16, 2, 11, hair)
    rect(c, x - 4, y - 17, 2, 2, "#e6c8cc")
    rect(c, x - 4, y - 5, 8, 3, shirt)
  }
}
export function drawTown(
  c: C,
  seconds: number,
  selected: number,
  labels: boolean,
  positions: Point[] = residents.map((r) => r.start),
  walking = false,
  activeSpeaker = -1,
  activity?: DestinationId
) {
  c.imageSmoothingEnabled = false
  rect(c, 0, 0, 480, 320, "#9db77a")
  let seed = 42
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < 3000; i++) {
    const x = Math.floor(rand() * 480),
      y = Math.floor(rand() * 320)
    rect(
      c,
      x,
      y,
      rand() > 0.8 ? 2 : 1,
      1,
      ["#91ac6c", "#aac183", "#b1c889", "#8faa6c"][i % 4]
    )
  }
  // Winding stream on the eastern edge.
  for (let y = 0; y < 320; y++) {
    const x = 448 + Math.round(Math.sin(y / 49) * 9)
    rect(c, x - 3, y, 40, 1, "#c6cd92")
    rect(c, x, y, 40, 1, "#79aaa2")
    if (y % 9 === 0) rect(c, x + 6 + (y % 17), y, 12, 1, "#b2cebb")
  }
  // Connected sandy lanes and cobbled square.
  rect(c, 117, 114, 272, 34, "#d8c396")
  rect(c, 211, 91, 31, 213, "#d8c396")
  rect(c, 300, 126, 28, 153, "#d8c396")
  rect(c, 57, 259, 354, 23, "#d8c396")
  rect(c, 184, 165, 102, 82, "#d9cba6")
  for (let y = 169; y < 245; y += 7)
    for (let x = 187; x < 283; x += 10) {
      rect(c, x + (y % 2 ? 2 : 0), y, 8, 5, (x + y) % 3 ? "#e4d7b5" : "#cec09c")
    }
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(rand() * 480),
      y = Math.floor(rand() * 320)
    if (
      (x > 212 && x < 241 && y > 96 && y < 300) ||
      (y > 116 && y < 147 && x > 120 && x < 389) ||
      (y > 260 && y < 281 && x > 60 && x < 410)
    )
      rect(c, x, y, 2, 1, "#c6b183")
  }
  fence(c, 50, 104, 7)
  fence(c, 151, 104, 5)
  fence(c, 267, 103, 4)
  fence(c, 388, 104, 4)
  fence(c, 36, 291, 14)
  fence(c, 292, 291, 14)
  building(c, 70, 42, 83, 69, "THE DAILY CUP", "#cd8362", 0)
  building(c, 309, 44, 88, 72, "THE GREEN ROOM", "#7f9271", 1)
  building(c, 338, 186, 78, 64, "THE MUSEUM", "#9e8190", 2)
  // Café terrace.
  for (const [x, y] of [
    [88, 132],
    [115, 139],
  ]) {
    rect(c, x - 2, y, 2, 9, "#806848")
    ellipse(c, x, y, 8, 4, "#ead6a2")
    rect(c, x - 11, y + 1, 4, 5, "#9b7851")
    rect(c, x + 9, y + 1, 4, 5, "#9b7851")
  }
  // Pond, stone bank, and water lilies.
  ellipse(c, 92, 222, 40, 23, "#bfc18c")
  ellipse(c, 92, 220, 36, 20, "#739e94")
  ellipse(c, 90, 217, 32, 16, "#85b3a5")
  for (let i = 0; i < 12; i++)
    rect(c, 67 + ((i * 17) % 49), 207 + ((i * 7) % 23), 6, 1, "#b1ccae")
  ellipse(c, 74, 222, 5, 2, "#739653")
  flower(c, 75, 219, "#eab2a0")
  ellipse(c, 107, 211, 4, 2, "#739653")
  // Fountain.
  ellipse(c, 236, 190, 19, 10, "#a79c7b")
  ellipse(c, 236, 187, 19, 10, "#ede0bd")
  ellipse(c, 236, 186, 15, 7, "#7eaaa0")
  ellipse(c, 236, 187, 10, 4, "#abc8b3")
  rect(c, 233, 174, 6, 13, "#c0b999")
  ellipse(c, 236, 173, 10, 4, "#eee2bf")
  ellipse(c, 236, 172, 7, 2, "#90b4a6")
  rect(c, 235, 163, 2, 10, "#d4e2c6")
  rect(c, 234, 162, 4, 2, "#eef0d2")
  bench(c, 158, 184)
  bench(c, 286, 184)
  bench(c, 265, 235)
  lamp(c, 180, 154)
  lamp(c, 291, 154)
  lamp(c, 185, 250)
  lamp(c, 320, 274)
  for (let i = 0; i < 75; i++) {
    const x = 20 + Math.floor(rand() * 405),
      y = 150 + Math.floor(rand() * 145)
    if (x < 54 || x > 418 || y > 285 || (x > 135 && x < 170 && y > 210))
      flower(c, x, y, ["#e9b08a", "#edda9d", "#f0dbc2"][i % 3])
  }
  for (const [x, y, s] of [
    [28, 55, 1.2],
    [54, 80, 1],
    [183, 70, 1.1],
    [265, 60, 1.2],
    [420, 70, 1.1],
    [33, 164, 1.1],
    [159, 224, 0.85],
    [423, 178, 1],
    [28, 266, 1.1],
    [146, 297, 1],
    [281, 292, 1],
    [423, 306, 1.2],
  ])
    tree(c, x, y, s)
  for (let x = 0; x < 480; x += 24) {
    pine(c, x, 31 + (x % 3) * 5)
    if (x < 65 || (x > 175 && x < 285) || x > 405) pine(c, x, 324)
  }
  for (const [x, y] of [
    [12, 103],
    [11, 208],
    [435, 125],
    [264, 96],
  ])
    pine(c, x, y)
  // A tiny community noticeboard.
  rect(c, 166, 131, 2, 14, "#826547")
  rect(c, 180, 131, 2, 14, "#826547")
  rect(c, 163, 119, 22, 15, "#976c46")
  rect(c, 165, 121, 18, 11, "#e9d4a5")
  rect(c, 168, 123, 5, 6, "#f6e7bf")
  rect(c, 176, 124, 4, 4, "#c78e70")
  residents.forEach((r, i) => {
    const [x, y] = positions[i]
    if (selected === i || activeSpeaker === i) {
      ellipse(c, x, y + 3, 9, 3, "#f5e1a0")
    }
    drawResident(c, i, x, y, walking, seconds)
    // Tiny original props make each completed outing visible in the town.
    if (activity === "cafe") {
      rect(c, x + 5, y - 8, 4, 4, "#f5e4b9")
      rect(c, x + 9, y - 7, 2, 2, "#d6bb87")
      rect(c, x + 6, y - 11 - Math.floor(seconds % 2), 1, 2, "#e8dfba")
    } else if (activity === "museum") {
      rect(c, x + 4, y - 9, 7, 7, "#99764d")
      rect(c, x + 5, y - 8, 5, 5, "#f0e3c0")
      rect(c, x + 6, y - 6, 3, 1, "#8b9b75")
      rect(c, x + 5 + (Math.floor(seconds * 2) % 3), y - 7, 1, 3, "#695947")
    } else if (activity === "music") {
      const lift = Math.floor(seconds * 2 + i) % 4
      rect(c, x + 7, y - 16 - lift, 1, 5, "#5a7255")
      rect(c, x + 5, y - 12 - lift, 2, 2, "#5a7255")
      rect(c, x + 8, y - 16 - lift, 2, 1, "#5a7255")
    }
    if (labels) {
      c.font = "bold 6px monospace"
      c.textAlign = "center"
      rect(c, x - 12, y - 28, 24, 9, "#f8efd8")
      c.fillStyle = "#4a5845"
      c.fillText(r.name, x, y - 21)
    }
  })
}
