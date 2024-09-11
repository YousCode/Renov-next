import { Navbar } from '@/components/Navbar';
import dynamic from 'next/dynamic';

const ExplorerView = dynamic(() => import('../../components/ExplorerView'), { ssr: false });

export default function ExplorerPage() {

  return (<>
  
  <Navbar/>
  <ExplorerView />
  </>
)
}



