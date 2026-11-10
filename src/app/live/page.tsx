import type {Metadata} from 'next';
import LiveProof from '@/components/live-proof';
export const metadata:Metadata={title:'Live Mainnet proof — Supplier Recall',description:'Live, read-only checks of Walrus Memory and Tatum on Sui Mainnet.'};
export default function Live(){return <LiveProof/>;}
