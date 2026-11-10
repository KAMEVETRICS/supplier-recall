import Workbench from '@/components/workbench';
import {createSampleWorkspace} from '@/domain/fixtures';
export const dynamic='force-dynamic';
export default function Home(){return <Workbench initial={createSampleWorkspace()}/>;}
