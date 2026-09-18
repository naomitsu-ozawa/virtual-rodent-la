export const MODEL_URL = 'https://cdn.jsdelivr.net/gh/erturklab/mouseMapper@7fe04a9ccf37664d76fe548ae226147c0023ceb7/Tissue_Module/example_data/organ_segmentation_sample/segmentation/CD68_chow_7790.nii.gz';
export const tissues = [
[-1,'body','体表',0xd7beaa,.10,false],[32,'bone','骨格',0xeee7cf,1,true],[33,'bone_marrow','骨髄',0xc77972,.65,false],
[5,'brain','脳',0xd895a8,1,true],[17,'spinal_cord','脊髄',0xe5b3bd,1,false],[4,'heart','心臓',0xaa3c41,1,true],
[3,'lungs','肺',0xdc919b,.92,true],[8,'liver','肝臓',0x91463d,1,true],[11,'stomach','胃',0xd09b87,1,true],
[12,'gut','腸管',0xd9a485,1,true],[2,'kidney','腎臓',0x7d4b37,1,true],[15,'pancreas','膵臓',0xdcb078,1,false],
[1,'spleen','脾臓',0x90465a,1,false],[22,'bladder','膀胱',0xd9ad7d,1,true],[6,'gallbladder','胆嚢',0x7d9a56,1,false],
[7,'adrenal','副腎',0xc79b61,1,false],[9,'thymus','胸腺',0xcba8a0,1,false],[14,'diaphragm','横隔膜',0xb97870,.85,false],
[18,'testes','精巣',0xd2b98f,1,false],[19,'preputial_gland','包皮腺',0xc9a990,1,false],[20,'peyers_patches','パイエル板',0xb8797c,1,false],
[21,'vesicular_gland','精嚢腺',0xc4a677,1,false],[23,'submandibular_gland','顎下腺',0xd3a58f,1,false],
[24,'sublingual_gland','舌下腺',0xd7b09c,1,false],[25,'parotid_gland','耳下腺',0xcf9f8d,1,false],
[26,'extraorbital_lacrimal','眼窩外涙腺',0xd2a394,1,false],[27,'orbital_lacrimal','眼窩涙腺',0xd7aa9a,1,false],
[29,'subcutaneous_fat','皮下脂肪',0xe3c38a,.35,false],[30,'visceral_fat','内臓脂肪',0xe0bb78,.35,false],
[31,'muscle','筋',0xad625e,.24,false],[16,'abdominal_wall','腹壁',0xba766b,.30,false],
].map(([id,key,label,color,opacity,defaultVisible])=>({id,key,label,color,opacity,defaultVisible}));
