import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

describe("useAuth", () => {
  describe("initial state", () => {
    it("returns isLoading as false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    it("sets isLoading to true during sign in and false after", async () => {
      let resolveSignIn!: (v: { success: boolean }) => void;
      const deferred = new Promise<{ success: boolean }>((res) => { resolveSignIn = res; });
      mockSignIn.mockReturnValue(deferred);

      const { result } = renderHook(() => useAuth());

      // Start sign in without awaiting
      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("user@example.com", "password123");
      });

      // isLoading should be true while the action is in-flight
      expect(result.current.isLoading).toBe(true);

      // Resolve and wait for completion
      await act(async () => {
        resolveSignIn({ success: true });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("calls signInAction with email and password", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
    });

    it("returns the result from signInAction on success", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    it("returns the result from signInAction on failure", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong-password");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    });

    it("does not call handlePostSignIn when sign in fails", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrong-password");
      });

      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("resets isLoading to false even if signInAction throws", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("user@example.com", "password123");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    it("sets isLoading to true during sign up and false after", async () => {
      let resolveSignUp!: (v: { success: boolean }) => void;
      const deferred = new Promise<{ success: boolean }>((res) => { resolveSignUp = res; });
      mockSignUp.mockReturnValue(deferred);

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: true });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("calls signUpAction with email and password", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
    });

    it("returns the result from signUpAction on success", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("new@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    it("returns the result from signUpAction on failure", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    });

    it("does not call handlePostSignIn when sign up fails", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("resets isLoading to false even if signUpAction throws", async () => {
      mockSignUp.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signUp("user@example.com", "password123");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("handlePostSignIn — anonymous work exists", () => {
    it("creates a project from anon work and redirects to it", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "Hello" }],
        fileSystemData: { "/App.jsx": "..." },
      });
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "Hello" }],
          data: { "/App.jsx": "..." },
        })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    it("does not fetch existing projects when anon work exists", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "Hello" }],
        fileSystemData: {},
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });
  });

  describe("handlePostSignIn — no anonymous work, existing projects", () => {
    it("redirects to most recent project when user has projects", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        { id: "project-1", name: "First", createdAt: new Date(), updatedAt: new Date() },
        { id: "project-2", name: "Second", createdAt: new Date(), updatedAt: new Date() },
      ] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  describe("handlePostSignIn — no anonymous work, no existing projects", () => {
    it("creates a new empty project and redirects to it", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "fresh-project-id" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
          data: {},
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/fresh-project-id");
    });
  });

  describe("handlePostSignIn — anon work with empty messages", () => {
    it("falls through to existing projects when anon messages are empty", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      mockGetProjects.mockResolvedValue([
        { id: "existing-project", name: "My Project", createdAt: new Date(), updatedAt: new Date() },
      ] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockGetProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });
  });
});
