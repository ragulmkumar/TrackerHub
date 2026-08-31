package models

import (
	"testing"
)

func TestNormalizeMAC_RemovesColonsAndUppercases(t *testing.T) {
	result, err := NormalizeMAC("c3:00:00:3e:7d:e0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "C300003E7DE0" {
		t.Errorf("expected C300003E7DE0, got %s", result)
	}
}

func TestNormalizeMAC_RemovesDashesAndUppercases(t *testing.T) {
	result, err := NormalizeMAC("c3-00-00-3e-7d-e0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "C300003E7DE0" {
		t.Errorf("expected C300003E7DE0, got %s", result)
	}
}

func TestNormalizeMAC_AlreadyNormalized(t *testing.T) {
	result, err := NormalizeMAC("C300003E7DE0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "C300003E7DE0" {
		t.Errorf("expected C300003E7DE0, got %s", result)
	}
}

func TestNormalizeMAC_EmptyStringReturnsEmpty(t *testing.T) {
	result, err := NormalizeMAC("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "" {
		t.Errorf("expected empty string, got %s", result)
	}
}

func TestNormalizeMAC_TooShortReturnsError(t *testing.T) {
	_, err := NormalizeMAC("AA:BB:CC")
	if err == nil {
		t.Fatal("expected error for too-short MAC")
	}
}

func TestNormalizeMAC_TooLongReturnsError(t *testing.T) {
	_, err := NormalizeMAC("AA:BB:CC:DD:EE:FF:00")
	if err == nil {
		t.Fatal("expected error for too-long MAC")
	}
}

func TestNormalizeMAC_NonHexReturnsError(t *testing.T) {
	_, err := NormalizeMAC("GG:HH:II:JJ:KK:LL")
	if err == nil {
		t.Fatal("expected error for non-hex MAC")
	}
}

func TestNormalizeMAC_SpacesReturnError(t *testing.T) {
	_, err := NormalizeMAC("AA BB CC DD EE FF")
	if err == nil {
		t.Fatal("expected error for MAC with spaces")
	}
}

func TestNormalizeMAC_AllZeroes(t *testing.T) {
	result, err := NormalizeMAC("00:00:00:00:00:00")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "000000000000" {
		t.Errorf("expected 000000000000, got %s", result)
	}
}

func TestNormalizeMAC_MixedCaseInput(t *testing.T) {
	result, err := NormalizeMAC("aA:bB:cC:dD:eE:fF")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "AABBCCDDEEFF" {
		t.Errorf("expected AABBCCDDEEFF, got %s", result)
	}
}

func TestWebUIBeaconConfigFields(t *testing.T) {
	beacon := WebUIBeaconConfig{
		UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
		Major:       1,
		Minor:       1,
		X:           3.0,
		Y:           4.0,
		TXPower:     -59,
		DisplayName: "Test Beacon",
		MACAddress:  "C300003E7DE0",
	}

	if beacon.UUID != "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0" {
		t.Error("UUID mismatch")
	}
	if beacon.Major != 1 || beacon.Minor != 1 {
		t.Error("Major/Minor mismatch")
	}
	if beacon.X != 3.0 || beacon.Y != 4.0 {
		t.Error("X/Y mismatch")
	}
	if beacon.TXPower != -59 {
		t.Error("TXPower mismatch")
	}
	if beacon.MACAddress != "C300003E7DE0" {
		t.Error("MACAddress mismatch")
	}
}
