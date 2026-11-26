import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit3 } from 'react-icons/fi';
import { Composer } from './Community';
import { toast } from '../utils/toast';

// /community/new: write a post on its own page, then open it at /community/post/<id>.
export default function CommunityNew() {
  const navigate = useNavigate();
  const sendRef = useRef(null);

  const onPosted = (post) => {
    toast.success('Posted to the community');
    navigate(`/community/post/${post.id}`, { replace: true });
  };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="lg:pr-64">
          <Link to="/community" className="inline-flex items-center gap-1.5 text-sm text-cs-text-dim hover:text-cs-text">
            <FiArrowLeft /> Community
          </Link>
          <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
            <FiEdit3 className="text-cs-primary" /> New post
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[40rem]">
        <p className="text-sm text-cs-text-dim mb-4">
          Share an idea, your progress, a question or something you built. Pick a type, write, and post.
        </p>
        <Composer onPosted={onPosted} sendRef={sendRef} />
      </div>
    </main>
  );
}
