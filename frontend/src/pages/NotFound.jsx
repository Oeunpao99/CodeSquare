import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

// Shown for any URL that doesn't match a page (and by pages whose item was not
// found). Illustration: frontend/public/illustrations/not-found.webp.
export default function NotFound({ title = 'Page not found' }) {
  const navigate = useNavigate();
  const [img, setImg] = useState(true);

  const back = () => navigate('/dashboard');

  return (
    <main className="w-full px-6 lg:px-10 py-10 grid place-items-center min-h-[80vh]">
      <div className="max-w-md w-full text-center">
        {img && (
          <img
            src="/illustrations/not-found.webp"
            alt=""
            onError={() => setImg(false)}
            className="w-full rounded-2xl mb-8"
          />
        )}
        <h1 className="text-3xl font-bold">{title}</h1>
        <button onClick={back} className="btn btn-primary mt-6"><FiArrowLeft /> Go back</button>
      </div>
    </main>
  );
}
