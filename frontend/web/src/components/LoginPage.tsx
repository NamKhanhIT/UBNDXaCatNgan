'use client';

import React from 'react';
import { SignInPage } from './ui/sign-in';
import { RoleCode } from '../services/role-hierarchy.service';

interface LoginPageProps {
  onLoginSuccess?: (role: RoleCode) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  return (
    <SignInPage
      onSignIn={(e, role) => {
        if (onLoginSuccess && role) {
          onLoginSuccess(role);
        }
      }}
    />
  );
}
