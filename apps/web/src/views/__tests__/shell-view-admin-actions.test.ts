import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";
import ShellView from "@/views/ShellView.vue";

const { httpGetMock, httpPostMock } = vi.hoisted(() => ({
  httpGetMock: vi.fn(),
  httpPostMock: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("powerbi-client", () => ({
  factories: {
    hpmFactory: {},
    wpmpFactory: {},
    routerFactory: {},
  },
  service: {
    Service: class {
      embed() {
        return {
          on: vi.fn(),
          off: vi.fn(),
        };
      }

      reset() {
        // noop
      }
    },
  },
  models: {
    TokenType: { Embed: 0 },
    DisplayOption: { FitToPage: 0 },
    LayoutType: { Custom: 0 },
  },
}));

vi.mock("@/api/http", () => ({
  http: {
    get: httpGetMock,
    post: httpPostMock,
  },
}));

vi.mock("@/ui/toast/useToast", () => ({
  useToast: () => ({
    push: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock("@/ui/confirm/useConfirm", () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock("@/auth/auth", () => ({
  logout: vi.fn(),
}));

type MountOptions = {
  isPlatformAdmin: boolean;
  canRefreshModel: boolean;
};

async function mountShellView({ isPlatformAdmin, canRefreshModel }: MountOptions) {
  httpGetMock.mockImplementation((url: string) => {
    if (url === "/users/me") {
      return Promise.resolve({
        data: {
          data: {
            email: "user@example.com",
            displayName: "User",
            status: "active",
            isPlatformAdmin,
            canRefreshModel,
          },
        },
      });
    }

    if (url === "/powerbi/workspaces") {
      return Promise.resolve({
        data: {
          data: [],
        },
      });
    }

    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });

  const wrapper = shallowMount(ShellView, {
    global: {
      stubs: {
        Teleport: true,
      },
    },
  });

  await flushPromises();

  return wrapper;
}

describe("ShellView admin actions", () => {
  beforeEach(() => {
    httpGetMock.mockReset();
    httpPostMock.mockReset();
  });

  it("shows model refresh action for platform admin", async () => {
    const wrapper = await mountShellView({
      isPlatformAdmin: false,
      canRefreshModel: true,
    });
    expect(wrapper.find('[aria-label="Atualizar modelo"]').exists()).toBe(true);
  });

  it("hides model refresh action for non-admin", async () => {
    const wrapper = await mountShellView({
      isPlatformAdmin: true,
      canRefreshModel: false,
    });
    expect(wrapper.find('[aria-label="Atualizar modelo"]').exists()).toBe(false);
  });
});
