// Default placement of the VR/AR volume and boards (build 488).
// Offsets are metres in the head's horizontal frame: fwd = ahead of the head
// (level), left = to the head's left (negative = right), down = below eye level.
// Quest 3 reads UI comfortably at about 0.75-1.5 m, so the boards sit at about
// 0.9 m (were 0.71 / 0.72 m). Their physical size and canvas are unchanged (owner's
// request), so they simply look a little smaller. The volume is at 0.65 m
// (was 0.55 m) and the boards are kept beside it, not in front of it.
export const VOLUME_FWD = 0.65, VOLUME_DOWN = 0.12;
export const MENU_OFFSET = { fwd: 0.78, left: 0.45, down: 0.2 };
export const HELP_OFFSET = { fwd: 0.78, left: -0.45, down: 0.2 };
// board widths in metres: unchanged from before (not scaled with the distance)
export const MENU_WIDTH = 0.5, HELP_WIDTH = 0.32;
// build 543: the HU histogram board sits above the help board (front-right, mirrored from the menu) and is 0.46 m wide.
export const HIST_OFFSET = { fwd: 0.78, left: -0.45, down: -0.1 };
export const HIST_WIDTH = 0.46;
export const boardDistance = o => Math.hypot(o.fwd, o.left, o.down);
// head: {x,y,z}; fwd / left: unit horizontal vectors {x,z}
export const placeFromHead = (head, fwd, left, o) => ({ x: head.x + fwd.x * o.fwd + left.x * o.left, y: head.y - o.down, z: head.z + fwd.z * o.fwd + left.z * o.left });
export const volumeFromHead = (head, fwd) => ({ x: head.x + fwd.x * VOLUME_FWD, y: head.y - VOLUME_DOWN, z: head.z + fwd.z * VOLUME_FWD });
