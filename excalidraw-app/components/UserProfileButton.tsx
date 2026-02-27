import { Popover } from "radix-ui";
import React, { useState } from "react";

import type { AuthUser } from "../auth/types";

import "./UserProfileButton.scss";

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const getAvatarUrl = (user: AuthUser): string | null => {
  if (user.avatarUrl) {
    return user.avatarUrl;
  }
  // Fallback: GitHub avatar from username
  if (user.username) {
    return `https://github.com/${user.username}.png?size=64`;
  }
  return null;
};

export const UserProfileButton: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = getAvatarUrl(user);
  const displayName = user.name || user.username;
  const initials = getInitials(displayName);

  return (
    <Popover.Root>
      <Popover.Trigger className="UserProfileButton__trigger">
        {avatarUrl && !imgError ? (
          <img
            className="UserProfileButton__avatar-img"
            src={avatarUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="UserProfileButton__avatar-initials">
            {initials}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="UserProfileButton__content"
          align="end"
          sideOffset={8}
        >
          <div className="UserProfileButton__card">
            <div className="UserProfileButton__card-avatar">
              {avatarUrl && !imgError ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="UserProfileButton__card-initials">
                  {initials}
                </span>
              )}
            </div>
            <div className="UserProfileButton__card-info">
              <div className="UserProfileButton__card-name">{displayName}</div>
              {user.email && (
                <div className="UserProfileButton__card-email">
                  {user.email}
                </div>
              )}
              {user.groups.length > 0 && (
                <div className="UserProfileButton__card-groups">
                  {user.groups.map((group) => (
                    <span key={group} className="UserProfileButton__group-tag">
                      {group}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Popover.Arrow
            width={12}
            height={6}
            style={{
              fill: "var(--popup-bg-color)",
              filter: "drop-shadow(rgba(0, 0, 0, 0.05) 0px 3px 2px)",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
