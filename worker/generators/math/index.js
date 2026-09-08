// Registry of the 38 maths generators — one per skill id in data/skills_math_ccss.json (docs/03 §3).
import * as G4_NBT_1 from './G4.NBT.1.js';
import * as G4_NBT_2 from './G4.NBT.2.js';
import * as G4_OA_F from './G4.OA.F.js';
import * as G4_NBT_3 from './G4.NBT.3.js';
import * as G4_NBT_4 from './G4.NBT.4.js';
import * as G4_OA_1 from './G4.OA.1.js';
import * as G4_OA_2 from './G4.OA.2.js';
import * as G4_NF_1 from './G4.NF.1.js';
import * as G4_NF_2 from './G4.NF.2.js';
import * as G4_NF_3 from './G4.NF.3.js';
import * as G4_MD_1 from './G4.MD.1.js';
import * as G4_MD_2 from './G4.MD.2.js';
import * as G4_G_1 from './G4.G.1.js';
import * as N5_NBT_1 from './5.NBT.1.js';
import * as N5_NBT_2 from './5.NBT.2.js';
import * as N5_NBT_RW from './5.NBT.RW.js';
import * as N5_NBT_5 from './5.NBT.5.js';
import * as N5_OA_PROP from './5.OA.PROP.js';
import * as N5_OA_1 from './5.OA.1.js';
import * as N5_OA_2 from './5.OA.2.js';
import * as N5_NBT_6a from './5.NBT.6a.js';
import * as N5_MP_1 from './5.MP.1.js';
import * as N5_NBT_6 from './5.NBT.6.js';
import * as N5_NBT_3 from './5.NBT.3.js';
import * as N5_NBT_4 from './5.NBT.4.js';
import * as N5_NBT_7 from './5.NBT.7.js';
import * as N5_NF_1 from './5.NF.1.js';
import * as N5_NF_2 from './5.NF.2.js';
import * as N5_NF_3 from './5.NF.3.js';
import * as N5_NF_4 from './5.NF.4.js';
import * as N5_NF_7 from './5.NF.7.js';
import * as N5_OA_3 from './5.OA.3.js';
import * as N5_MD_1 from './5.MD.1.js';
import * as N5_MD_2 from './5.MD.2.js';
import * as N5_MD_3 from './5.MD.3.js';
import * as N5_G_1 from './5.G.1.js';
import * as N5_G_3 from './5.G.3.js';
import * as N5_FLU from './5.FLU.js';
import { rngFor } from '../../src/rng.js';
import { stemHash, itemKey } from '../../src/items.js';

export const registry = {
  'G4.NBT.1': G4_NBT_1, 'G4.NBT.2': G4_NBT_2, 'G4.OA.F': G4_OA_F, 'G4.NBT.3': G4_NBT_3, 'G4.NBT.4': G4_NBT_4, 'G4.OA.1': G4_OA_1, 'G4.OA.2': G4_OA_2,
  'G4.NF.1': G4_NF_1, 'G4.NF.2': G4_NF_2, 'G4.NF.3': G4_NF_3, 'G4.MD.1': G4_MD_1, 'G4.MD.2': G4_MD_2, 'G4.G.1': G4_G_1,
  '5.NBT.1': N5_NBT_1, '5.NBT.2': N5_NBT_2, '5.NBT.RW': N5_NBT_RW, '5.NBT.5': N5_NBT_5, '5.OA.PROP': N5_OA_PROP, '5.OA.1': N5_OA_1, '5.OA.2': N5_OA_2,
  '5.NBT.6a': N5_NBT_6a, '5.MP.1': N5_MP_1, '5.NBT.6': N5_NBT_6, '5.NBT.3': N5_NBT_3, '5.NBT.4': N5_NBT_4, '5.NBT.7': N5_NBT_7,
  '5.NF.1': N5_NF_1, '5.NF.2': N5_NF_2, '5.NF.3': N5_NF_3, '5.NF.4': N5_NF_4, '5.NF.7': N5_NF_7, '5.OA.3': N5_OA_3,
  '5.MD.1': N5_MD_1, '5.MD.2': N5_MD_2, '5.MD.3': N5_MD_3, '5.G.1': N5_G_1, '5.G.3': N5_G_3, '5.FLU': N5_FLU,
};

/** Generate one item for a skill at a tier from a seed string (student + test + position → never the same twice). */
export function generateMathItem(skillId, tier, seed) {
  const gen = registry[skillId];
  if (!gen) return null;
  const it = gen.generate(tier, rngFor(skillId, tier, seed));
  return { ...it, skill_id: skillId, tier, generated_by: 'template', source_style: 'GoMath', stem_hash: stemHash(itemKey(it)), seed };
}
