# frozen_string_literal: true

require 'spec_helper'

describe 'Scoundrel::Json' do
  it 'serializes dates' do
    created_at = Time.utc(2024, 1, 2, 3, 4, 5)
    json = Scoundrel::Json.dump({ created_at: created_at })
    parsed = Scoundrel::Json.load(json)

    expect(parsed['created_at']).to be_a(Time)
    expect(parsed['created_at'].utc.iso8601).to eq(created_at.iso8601)
  end

  it 'serializes regex values' do
    matcher = /scoundrel/im
    json = Scoundrel::Json.dump({ matcher: matcher })
    parsed = Scoundrel::Json.load(json)

    expect(parsed['matcher']).to be_a(Regexp)
    expect(parsed['matcher'].source).to eq('scoundrel')
    expect(parsed['matcher'].options & Regexp::IGNORECASE).not_to eq(0)
    expect(parsed['matcher'].options & Regexp::MULTILINE).not_to eq(0)
  end
end
