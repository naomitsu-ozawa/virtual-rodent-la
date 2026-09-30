// Conservative per-segment brick flags. Low nibble: the legacy HU range
// test. High nibble: the same test, tightened only by provably empty mask
// or classification support. Never use voxel-centre labels to reject HU
// interpolation: an interval can cross a threshold between two voxels.
const support=(cell,cells,size)=>[
 Math.max(0,Math.floor(cell*size/cells-0.5)),
 Math.min(size-1,Math.floor((cell+1)*size/cells-0.5)+1)
];

const supportGrid=(dims,brickDims)=>dims.map((size,i)=>Array.from({length:brickDims[i]},(_,cell)=>support(cell,brickDims[i],size)));

function supportHasValue(data,dims,channels,channel,x,y,z,grid){
 const [w,h]=dims;
 const [x0,x1]=grid[0][x],[y0,y1]=grid[1][y],[z0,z1]=grid[2][z];
 for(let k=z0;k<=z1;k++)for(let j=y0;j<=y1;j++){
  let o=((k*h+j)*w+x0)*channels+channel;
  for(let i=x0;i<=x1;i++,o+=channels)if(data[o]>=128)return true;
 }
 return false;
}

export function buildVrBrickFlags(volume,segments,edit=null,classification=null){
 const [bx,by,bz]=volume.brickDims,out=new Uint8Array(bx*by*bz);
 const ranges=segments.slice(0,4).map(s=>[Math.fround(+s?.min||0),Math.fround(+s?.max||0)]);
 const mask=edit?.data&&edit.data.length===edit.dims[0]*edit.dims[1]*edit.dims[2]*4?edit:null;
 const maskGrid=mask?supportGrid(mask.dims,volume.brickDims):null,clsGrid=classification?supportGrid(volume.dims,volume.brickDims):null;
 for(let z=0;z<bz;z++)for(let y=0;y<by;y++)for(let x=0;x<bx;x++){
  const b=(z*by+y)*bx+x,lo=volume.bricks[b*2],hi=volume.bricks[b*2+1];let raw=0,processed=0;
  for(let s=0;s<ranges.length;s++){
   const [min,max]=ranges[s];if(max<lo||min>hi)continue;
   const bit=1<<s;raw|=bit;let possible=true;
   if(classification){
    const ch=classification.chan[s];
    // A segment without a stored channel never passes segmentIndexAt.
    possible=ch>=0&&supportHasValue(classification.data,volume.dims,classification.C,ch,x,y,z,clsGrid);
   }else if(mask&&(mask.active&bit)){
    possible=supportHasValue(mask.data,mask.dims,4,s,x,y,z,maskGrid);
   }
   if(possible)processed|=bit;
  }
  out[b]=raw|(processed<<4);
 }
 return out;
}
