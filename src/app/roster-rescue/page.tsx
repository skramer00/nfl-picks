import type { Metadata } from 'next';
import RosterRescue from './RosterRescue';
export const metadata:Metadata={title:'Roster Rescue | Pretzel Quest',description:'Nine roster spots. Three swaps. Rescue a fantasy team in a daily football puzzle or unlimited practice.'};
export default function Page(){return <RosterRescue/>;}
