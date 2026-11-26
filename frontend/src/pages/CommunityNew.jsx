import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CommunityBanner from '../components/CommunityBanner';
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
      <CommunityBanner
        title="Share with the community"
        subtitle="A win, a question, or something you built."
        className="mb-6"
      />

      <Composer onPosted={onPosted} sendRef={sendRef} split />
    </main>
  );
}
