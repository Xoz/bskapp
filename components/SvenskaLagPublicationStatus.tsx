"use client";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export default function SvenskaLagPublicationStatus({message,pending}:{message:string;pending:boolean}) {
 const router=useRouter();
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>router.refresh(),10000);return()=>clearInterval(timer);},[pending,router]);
 return <p role="status">{message}</p>;
}
