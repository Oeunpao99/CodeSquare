import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit3 } from 'react-icons/fi';
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

      <div className="mx-auto w-full max-w-[40rem]">
        <p className="text-sm text-cs-text-dim mb-4">
          Share an idea, your progress, a question or something you built. Pick a type, write, and post.
        </p>
        <Composer onPosted={onPosted} sendRef={sendRef} />
      </div>
    </main>
  );
}
