$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class KeyboardWedge {
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public InputUnion data; }
    [StructLayout(LayoutKind.Explicit)] struct InputUnion {
        [FieldOffset(0)] public KEYBDINPUT keyboard;
        [FieldOffset(0)] public MOUSEINPUT mouse;
    }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT {
        public ushort vk, scan; public uint flags, time; public UIntPtr extra;
    }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT {
        public int dx, dy; public uint mouseData, flags, time; public UIntPtr extra;
    }
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    public static void Type(string text, string suffix) {
        int extra = suffix == "Enter" || suffix == "Tab" ? 2 : 0;
        INPUT[] inputs = new INPUT[text.Length * 2 + extra];
        int i = 0;
        foreach (char c in text) {
            inputs[i++] = new INPUT { type = 1, data = new InputUnion { keyboard = new KEYBDINPUT { scan = c, flags = 4 } } };
            inputs[i++] = new INPUT { type = 1, data = new InputUnion { keyboard = new KEYBDINPUT { scan = c, flags = 6 } } };
        }
        if (extra != 0) {
            ushort key = suffix == "Enter" ? (ushort)0x0d : (ushort)0x09;
            inputs[i++] = new INPUT { type = 1, data = new InputUnion { keyboard = new KEYBDINPUT { vk = key } } };
            inputs[i++] = new INPUT { type = 1, data = new InputUnion { keyboard = new KEYBDINPUT { vk = key, flags = 2 } } };
        }
        if (inputs.Length > 0 && SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) != inputs.Length)
            throw new InvalidOperationException("Windows rejected some keyboard input. Check application privilege levels.");
    }
}
'@
$inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
[KeyboardWedge]::Type([string]$inputData.text, [string]$inputData.suffix)
