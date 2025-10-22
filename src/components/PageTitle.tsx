import { useEffect } from 'react';

export default function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
  return null;
}
